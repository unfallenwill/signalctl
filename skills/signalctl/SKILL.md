---
name: signalctl
description: Query Grafana observability data via the signalctl CLI — metrics (PromQL/VictoriaMetrics), logs (LogsQL/VictoriaLogs), traces (Jaeger/VictoriaTraces). Use when investigating incidents, checking service health, searching logs, analyzing slow or failed requests, listing metrics/labels, or inspecting datasource UIDs on a Grafana instance.
---

# signalctl

Read-only CLI that queries a Grafana instance and prints structured JSON to stdout. Designed for agents: stable output schemas, single JSON error envelope on stderr, exit 0/1.

## Prerequisites

Requires env vars (or global flags `--server`, `--token`):

```sh
export GRAFANA_SERVER=https://grafana.example.com
export GRAFANA_TOKEN=glsa_xxx...
```

Datasource UIDs default to a known stack; override with `GRAFANA_METRICS_UID` / `GRAFANA_LOGS_UID` / `GRAFANA_TRACES_UID` or `--metrics-uid` / `--logs-uid` / `--traces-uid`. If unsure, confirm UIDs first:

```sh
signalctl datasources list   # [{id, uid, name, type, url, isDefault}, ...]
```

`.env` files are NOT read. The binary is `node dist/index.mjs` (or `signalctl` after `npm link`).

## Commands

```sh
# Metrics (PromQL)
signalctl metrics query <promql>          [--time now|5m|ISO|unix] [--format json|ndjson|table]
signalctl metrics range <promql>          [--start 1h] [--end now] [--step 30s] [--format json|table]
signalctl metrics series <selector>       [--start 1h] [--end now] [--limit 1000]
signalctl metrics labels                  [--start 1h] [--end now]
signalctl metrics label-values <name>     [--start 1h] [--end now]      # '__name__' lists metric names

# Logs (LogsQL)
signalctl logs query <logsql>             [--limit 100] [--start 1h] [--end now] [--format ndjson|json]

# Traces (Jaeger)
signalctl traces services                                                 # ["frontend", ...]
signalctl traces get <service>            [--lookback 1h] [--limit 20] [--raw]
signalctl traces trace <traceID>                                          # always full Jaeger JSON

signalctl datasources list                [--format json|table]
signalctl version
```

Every subcommand supports `--help`. Global flags on any command: `--server`, `--token`, `--metrics-uid`, `--logs-uid`, `--traces-uid`, `--no-color`.

## Time & duration formats

- `--time/--start/--end`: `now`, relative (`5m`, `1h`, `24h`, `7d`), ISO 8601, or unix seconds/ms (10/13 digits). Relative means "ago".
- `--step`: `30s`, `5m`, `1h`, `2d`.
- All time filtering is server-side — always pass `--start/--end/--limit/--lookback` instead of filtering client-side.

## Output schemas (stable; treat as API)

- `metrics query`: `[{metric:{<labels>}, value:[<unix_s>,"<v>"]}]`
- `metrics range`: `[{metric, values:[[<unix_s>,"<v>"],...]}]`
- `metrics labels` / `label-values`: `["name", ...]`
- `metrics series`: `[{<label>:"<value>", ...}]`
- `logs query`: NDJSON by default, one record per line (`{_time,_msg,_stream,_stream_id,severity,"service.name",...}`); `--format json` returns one array. Zero matches → stdout is completely empty (exit 0) — treat empty stdout as `[]`, do not JSON.parse it
- `traces get` (default summary): `[{traceID, rootSpan:{service,operation,duration_us,startTime,status} | null, spanCount, errorCount}]` — `status` is `ok|error|unset`; multi-root traces return only the first root; `rootSpan` is `null` when no span is a root (all have references)
- `traces get --raw` / `traces trace`: `[{traceID, spans:[...], processes:{...}}]` (can be hundreds of KB — avoid unless every span is needed)
- `datasources list`: `[{id, uid, name, type, url, isDefault, ...}]`

## Error handling

Any failure prints one JSON object to stderr and exits 1; stdout stays parseable:

```jsonc
{"error":"auth_error","message":"GRAFANA_TOKEN is not set (export it or pass --token)"}
```

Codes: `auth_error`, `validation_error`, `not_found`, `timeout` (default 30s — narrow `--start`/raise `--step` if hit), `network_error`, `server_error`, `parse_error`, `internal_error`. On failure, read stderr JSON, fix, retry — no stack traces exist.

## Query language quick reference

**PromQL** (metrics): standard PromQL. Discover data first:

```sh
signalctl metrics label-values __name__       # metric names
signalctl metrics labels                      # label names
signalctl metrics label-values service_name
```

**LogsQL** (logs, VictoriaLogs syntax):

```sh
'*'                                          # everything
'error'                                      # substring in _msg
'_stream:{service.name="frontend"}'          # by service
'severity:ERROR'                             # field match
'severity:ERROR AND service.name:frontend'   # combined
```

Common auto-extracted fields: `severity`, `service.name`, `code.file.path`, `http.method`, `http.status_code`.

## Investigation workflow

Typical incident flow — always narrow server-side:

1. Orient: `traces services`, `metrics label-values __name__`, or `logs query '*' --limit 10`
2. Find bad traces: `traces get <service> --lookback 1h --limit 20` — sort by `duration_us` / filter `errorCount > 0` mentally
3. Drill into one trace: `traces trace <traceID>` (full spans, tags, processes)
4. Correlate logs: `logs query 'service.name:<service>' --start <window> --limit 100`
5. Correlate metrics: `metrics range '<promql>' --start <window> --step 30s`

## Conventions

- Prefer the summary trace output; use `--raw` only when span-level detail is required.
- Keep `--limit` small; raw log/trace payloads overflow context quickly.
- Read-only tool: no write operations exist by design.
