CREATE TABLE IF NOT EXISTS sensors (
  id SERIAL PRIMARY KEY,
  station_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS readings (
  id BIGSERIAL PRIMARY KEY,
  station_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS readings_station_metric_ts_idx
  ON readings (station_id, metric, ts DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity TEXT NOT NULL,
  area TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb
);
