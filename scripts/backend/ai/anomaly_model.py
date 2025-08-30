"""
Lightweight anomaly detection:
- LSTM forecaster (PyTorch) for short sequences
- Residual z-score based anomaly flags
This is tuned for hackathon speed, not production-grade accuracy.
"""

from typing import List, Dict, Any
import numpy as np
import torch
import torch.nn as nn

class LSTMRegressor(nn.Module):
    def __init__(self, input_size=1, hidden_size=16, num_layers=1):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        # x: [B, T, 1]
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])  # predict next step
        return out  # [B,1]

class AnomalyDetector:
    def __init__(self, seq_len: int = 24, device: str = "cpu", epochs: int = 10, lr: float = 1e-2):
        self.seq_len = seq_len
        self.device = device
        self.epochs = epochs
        self.lr = lr
        self.model = LSTMRegressor().to(self.device)
        self.criterion = nn.MSELoss()
        self.opt = torch.optim.Adam(self.model.parameters(), lr=self.lr)

    def _make_sequences(self, values: List[float]):
        arr = np.array(values, dtype=np.float32)
        X, y = [], []
        for i in range(len(arr) - self.seq_len):
            X.append(arr[i:i+self.seq_len])
            y.append(arr[i+self.seq_len])
        if not X:
            return None, None
        X = np.array(X)[:, :, None]  # [N,T,1]
        y = np.array(y)[:, None]     # [N,1]
        return X, y

    def fit(self, values: List[float]):
        X, y = self._make_sequences(values)
        if X is None:
            return False
        X_t = torch.tensor(X, device=self.device)
        y_t = torch.tensor(y, device=self.device)
        self.model.train()
        for _ in range(self.epochs):
            pred = self.model(X_t)
            loss = self.criterion(pred, y_t)
            self.opt.zero_grad()
            loss.backward()
            self.opt.step()
        return True

    def predict_next(self, seq: List[float]) -> float:
        self.model.eval()
        x = torch.tensor(np.array(seq, dtype=np.float32)[None, :, None], device=self.device)
        with torch.no_grad():
            yhat = self.model(x)
        return float(yhat.cpu().numpy().squeeze())

    def detect_anomalies(self, values: List[float]) -> Dict[str, Any]:
        # Train on first 70%, test on remaining for residual-based anomaly flags
        n = len(values)
        split = max(self.seq_len + 1, int(0.7 * n))
        train_vals = values[:split]
        test_vals = values[split-self.seq_len:]  # include overlap for warmup

        ok = self.fit(train_vals)
        if not ok:
            arr = np.array(values)
            z = (arr - arr.mean()) / (arr.std() + 1e-6)
            flags = (np.abs(z) > 2.5).tolist()
            return {"method": "zscore_fallback", "anomaly_flags": flags, "z": z.tolist()}

        preds = []
        for i in range(self.seq_len, len(test_vals)):
            seq = test_vals[i-self.seq_len:i]
            preds.append(self.predict_next(seq))

        # Align preds with actuals
        actual = test_vals[self.seq_len:]
        residuals = np.array(actual) - np.array(preds)
        mu, sd = residuals.mean(), residuals.std() + 1e-6
        z = (residuals - mu) / sd
        flags = (np.abs(z) > 2.5).tolist()

        return {
            "method": "lstm_residual_z",
            "predictions": preds,
            "actual": actual,
            "residuals": residuals.tolist(),
            "z": z.tolist(),
            "anomaly_flags": flags,
            "split_index": split,
        }
