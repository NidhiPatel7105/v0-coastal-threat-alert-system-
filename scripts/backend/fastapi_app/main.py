"""
FastAPI backend for Coastal Threat Alert System.
- Real-time + historical ingestion endpoints
- NOAA historical fetch example
- Anomaly detection endpoint using PyTorch LSTM + z-score fallback
- WebSocket broadcast for alerts (prototype)
Note: For hackathon demo, persistence is optional. You can add PostgreSQL via DATABASE_URL later.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import uvicorn
from datetime import datetime, timedelta

from scripts.backend.ingestion.noaa_client import fetch_tide_data
from scripts.backend.ai.anomaly_model import AnomalyDetector

app = FastAPI(title="Coastal Threat Alert API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # relax for hackathon demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores for prototype
READINGS: Dict[str, List[Dict[str, Any]]] = {}  # key: station_id
ALERTS: List[Dict[str, Any]] = []

anomaly_detector = AnomalyDetector(seq_len=24, device="cpu")  # small window for demo

class Reading(BaseModel):
    ts: datetime
    station_id: str
    metric: str  # e.g., "sea_level", "wind_speed", "pollution_index"
    value: float

class IngestBatch(BaseModel):
    readings: List[Reading]

class AnalyzeRequest(BaseModel):
    station_id: str
    metric: str
    lookback_hours: int = 24

class Alert(BaseModel):
    message: str
    severity: str  # "info","watch","warning","danger"
    area: str
    ts: Optional[datetime] = None
    meta: Optional[Dict[str, Any]] = None

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        living = []
        for ws in self.active:
            try:
                await ws.send_json(message)
                living.append(ws)
            except WebSocketDisconnect:
                continue
        self.active = living

manager = ConnectionManager()

@app.get("/health")
def health():
    return {"status": "ok", "alerts_count": len(ALERTS), "stations": list(READINGS.keys())}

@app.post("/ingest/realtime")
def ingest_realtime(payload: IngestBatch):
    for r in payload.readings:
        key = f"{r.station_id}:{r.metric}"
        READINGS.setdefault(key, []).append(r.model_dump())
        # keep only last 7 days for memory
        cutoff = datetime.utcnow() - timedelta(days=7)
        READINGS[key] = [x for x in READINGS[key] if x["ts"] >= cutoff]
    return {"ok": True, "inserted": len(payload.readings)}

@app.post("/ingest/historical")
def ingest_historical(
    station_id: str = Query(...),
    begin_date: str = Query(..., description="YYYYMMDD"),
    end_date: str = Query(..., description="YYYYMMDD"),
):
    # Fetch NOAA water level history and store
    data = fetch_tide_data(station_id, begin_date, end_date)
    inserted = 0
    for d in data:
        key = f"{station_id}:sea_level"
        READINGS.setdefault(key, []).append({
            "ts": d["ts"],
            "station_id": station_id,
            "metric": "sea_level",
            "value": d["value"],
        })
        inserted += 1
    return {"ok": True, "inserted": inserted}

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    key = f"{req.station_id}:{req.metric}"
    series = READINGS.get(key, [])
    if not series:
        return {"ok": False, "reason": "no_data"}

    # Extract last N hours
    cutoff = datetime.utcnow() - timedelta(hours=req.lookback_hours)
    values = [x["value"] for x in series if x["ts"] >= cutoff]
    if len(values) < anomaly_detector.seq_len + 1:
        return {"ok": False, "reason": "insufficient_data"}

    result = anomaly_detector.detect_anomalies(values)
    return {"ok": True, "result": result}

@app.post("/alerts")
async def post_alert(alert: Alert):
    a = alert.model_dump()
    a["ts"] = a.get("ts") or datetime.utcnow()
    ALERTS.append(a)
    # Broadcast to WS listeners
    await manager.broadcast({"type": "alert", "data": a})
    return {"ok": True}

@app.get("/alerts")
def list_alerts(limit: int = 50):
    return {"ok": True, "alerts": ALERTS[-limit:]}

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # send recent alerts upon connection
        await websocket.send_json({"type": "recent", "data": ALERTS[-20:]})
        while True:
            # keep-alive; client->server messages optional
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    # Run: python scripts/backend/fastapi_app/main.py
    uvicorn.run(app, host="0.0.0.0", port=8000)
