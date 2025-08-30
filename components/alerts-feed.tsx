"use client"

import useSWR from "swr"
import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"

type Alert = { message: string; severity: string; area: string; ts: string; meta?: any }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function severityColor(sev: string) {
  switch (sev) {
    case "danger":
      return "bg-red-600 text-white"
    case "warning":
      return "bg-amber-500 text-black"
    case "watch":
      return "bg-blue-500 text-white"
    default:
      return "bg-slate-600 text-white"
  }
}

export default function AlertsFeed() {
  const { data, mutate } = useSWR<{ ok: boolean; alerts: Alert[] }>("/api/alerts", fetcher, { refreshInterval: 5000 })
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Optional: use backend WS when available. For demo, we refresh via SWR polling.
    // wsRef.current = new WebSocket("ws://localhost:8000/ws/alerts")
    // wsRef.current.onmessage = () => mutate()
    return () => {
      wsRef.current?.close()
    }
  }, [mutate])

  const alerts = data?.alerts ?? []
  return (
    <ul className="space-y-3">
      {alerts
        .slice()
        .reverse()
        .map((a, i) => (
          <li key={i} className="flex items-start gap-3 rounded-md border p-3">
            <Badge className={`rounded ${severityColor(a.severity)}`}>{a.severity.toUpperCase()}</Badge>
            <div className="flex-1">
              <div className="text-sm">{a.message}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(a.ts).toLocaleString()} • {a.area}
              </div>
            </div>
          </li>
        ))}
      {alerts.length === 0 && <li className="text-sm text-muted-foreground">No alerts yet.</li>}
    </ul>
  )
}
