import { NextResponse } from "next/server"

function rnd(n = 1, sd = 1) {
  return n + (Math.random() - 0.5) * sd
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const station = url.searchParams.get("station") ?? "8454000"
  const now = Date.now()
  const points = 120 // ~2 hours @ one per minute

  const series = Array.from({ length: points }, (_, i) => {
    const ts = new Date(now - (points - 1 - i) * 60_000)
    // Toy trends
    const sea_base = Math.sin(i / 12) * 0.2 + 1.2
    const wind_base = Math.abs(Math.sin(i / 10)) * 4 + 3
    const poll_base = Math.abs(Math.cos(i / 15)) * 3 + 2
    return {
      ts: ts.toISOString(),
      sea_level: sea_base + (Math.random() - 0.5) * 0.05,
      wind_speed: wind_base + (Math.random() - 0.5) * 0.3,
      pollution_index: poll_base + (Math.random() - 0.5) * 0.4,
    }
  })

  const live = series[series.length - 1]

  return NextResponse.json({ station, live, series })
}
