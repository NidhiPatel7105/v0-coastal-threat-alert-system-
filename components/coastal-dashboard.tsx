"use client"

import useSWR from "swr"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import AlertsFeed from "./alerts-feed"
import NotifyButton from "./notify-button"

type LiveData = {
  ts: string
  sea_level: number
  wind_speed: number
  pollution_index: number
}
type SeriesPoint = { ts: string; sea_level: number; wind_speed: number; pollution_index: number }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function CoastalDashboard() {
  const [station] = useState("8454000") // demo station ID
  const { data, isLoading } = useSWR<{ live: LiveData; series: SeriesPoint[] }>(
    `/api/mock/live?station=${station}`,
    fetcher,
    { refreshInterval: 4000 },
  )

  const live = data?.live
  const series = data?.series || []

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 font-sans">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-balance">Coastal Threat Alert</h1>
          <p className="text-sm text-muted-foreground">Live status, anomalies, and alerts for coastal zones</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            Station {station}
          </Badge>
          <NotifyButton />
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard title="Sea Level (m)" value={live?.sea_level} loading={isLoading} tone="primary" />
        <MetricCard title="Wind Speed (m/s)" value={live?.wind_speed} loading={isLoading} tone="info" />
        <MetricCard title="Pollution Index" value={live?.pollution_index} loading={isLoading} tone="warn" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Trends (Last ~2 hours)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer
              config={{
                sea_level: { label: "Sea Level", color: "hsl(var(--chart-1))" },
                wind_speed: { label: "Wind", color: "hsl(var(--chart-2))" },
                pollution_index: { label: "Pollution", color: "hsl(var(--chart-3))" },
              }}
              className="h-[280px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ts" hide />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sea_level"
                    stroke="var(--color-sea_level)"
                    name="Sea Level"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="wind_speed"
                    stroke="var(--color-wind_speed)"
                    name="Wind Speed"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pollution_index"
                    stroke="var(--color-pollution_index)"
                    name="Pollution"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Threat Likelihood</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer
              config={{ likelihood: { label: "Likelihood", color: "hsl(var(--chart-4))" } }}
              className="h-[280px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={series.map((p) => ({
                    ts: p.ts,
                    likelihood: Math.max(0, Math.min(100, p.pollution_index * 10 + p.wind_speed * 4)),
                  }))}
                >
                  <defs>
                    <linearGradient id="likelihoodFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-likelihood)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-likelihood)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ts" hide />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="likelihood"
                    stroke="var(--color-likelihood)"
                    fill="url(#likelihoodFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-6" />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Alerts</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await fetch("/api/alerts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      message: "High surf and rising tide detected near harbor entrance.",
                      severity: "warning",
                      area: "Harbor A",
                    }),
                  })
                }}
              >
                Trigger Test Alert
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <AlertsFeed />
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Live metrics update every few seconds (mock API).</p>
            <p>• Alerts stream into the feed; click “Trigger Test Alert”.</p>
            <p>• SMS/Push will send if environment variables are configured.</p>
            <p>• Python backend included for real ingestion + ML demo.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MetricCard({
  title,
  value,
  loading,
  tone,
}: { title: string; value: number | undefined; loading: boolean; tone: "primary" | "info" | "warn" }) {
  const toneClass =
    tone === "primary"
      ? "text-blue-600 dark:text-blue-400"
      : tone === "info"
        ? "text-teal-600 dark:text-teal-400"
        : "text-amber-600 dark:text-amber-400"

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-3xl font-semibold ${toneClass}`}>{loading ? "—" : (value?.toFixed(2) ?? "—")}</div>
      </CardContent>
    </Card>
  )
}
