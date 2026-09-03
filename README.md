# signalctl

> Grafana metrics, logs, and traces CLI designed for AI agents and humans.

Query a Grafana instance from the terminal and paste the result straight into a prompt. Every response is structured JSON with a stable schema; errors come back as a uniform envelope on stderr.

- **Three telemetry sources, one CLI** — metrics (PromQL via VictoriaMetrics), logs (LogsQL via VictoriaLogs), traces (Jaeger-compatible via VictoriaTraces)
- **Server-side filtering** — push PromQL/LogsQL/jaeger query parameters to the datasource; the CLI never pulls more than needed
- **Trace summary by default** — full Jaeger JSON can be hundreds of KB; the default `{traceID, rootSpan, spanCount, errorCount}` shape is small enough to embed in any LLM context
- **Strict, parseable error envelope** — every failure exits non-zero and prints `{"error": "<code>", "message": "..."}` on stderr; no stack traces

## Install

```sh
npm install
npm run build
```

The compiled binary is `dist/index.mjs`. Node.js 18+ is required.

```sh
# Run directly
node dist/index.mjs --help

# Or expose globally
npm link   # now `signalctl` is on $PATH
```

## Quick Start

```sh
export GRAFANA_SERVER=https://grafana.example.com
export GRAFANA_TOKEN=glsa_xxx...

# What services are emitting traces?
signalctl traces services
# ["frontend","backend"]

# Slowest traces in the last hour
signalctl traces get frontend --lookback 1h --limit 5

# ERROR logs from one service
signalctl logs query 'severity:ERROR AND service.name:frontend' --limit 10

# QPS per endpoint
signalctl metrics query \
  'sum by (http_method, http_target) (rate(http_server_request_size_bytes_count[5m]))' \
  --time now
```

## Configuration

Two environment variables are required.

| Variable | Required | Example |
|---|---|---|
| `GRAFANA_SERVER` | yes | `https://grafana.example.com` |
| `GRAFANA_TOKEN` | yes | `glsa_xxx...` (Grafana service-account token) |

Optional UID defaults (override to point at your own Grafana stack):

| Variable | Default | Datasource |
|---|---|---|
| `GRAFANA_METRICS_UID` | `P4169E866C3094E38` | VictoriaMetrics |
| `GRAFANA_LOGS_UID` | `PD775F2863313E6C7` | VictoriaLogs |
| `GRAFANA_TRACES_UID` | `P14D5514F5CCC0D1C` | VictoriaTraces (Jaeger) |

The CLI also accepts `--server`, `--token`, `--metrics-uid`, `--logs-uid`, `--traces-uid` as per-command overrides. `.env` files are **not** read — export variables directly in your shell.

## Usage

Every command returns JSON on stdout (one line for NDJSON, an array otherwise) and exits 0 on success. Errors go to stderr as a JSON envelope and exit non-zero.

### Metrics

```sh
# Instant PromQL query
signalctl metrics query 'vector(1)' --time now
signalctl metrics query 'up' --time now

# Range query over the last hour
signalctl metrics range 'rate(http_server_request_size_bytes_count[5m])' \
  --start 1h --end now --step 30s

# List available metric names (use the `__name__` label)
signalctl metrics label-values __name__

# List all label names in a time range
signalctl metrics labels --start 1h --end now

# List matching series (heavy — narrow the selector)
signalctl metrics series '{http_method="POST",service_name="backend"}' \
  --start 1h --limit 50
```

### Logs

```sh
# Everything recent (NDJSON, one record per line)
signalctl logs query '*' --limit 100 --start 1h

# Single JSON array instead of NDJSON
signalctl logs query '*' --limit 100 --format json

# ERROR-level records for one service
signalctl logs query 'severity:ERROR AND service.name:frontend' --limit 10

# Substring match on the message field
signalctl logs query 'connection' --limit 20
```

Common LogsQL fields (auto-extracted from `_stream`): `severity`, `service.name`, `code.file.path`, `http.method`, `http.status_code`. See `signalctl logs query --help` for full guidance.

### Traces

```sh
# List services emitting traces
signalctl traces services

# Recent traces for one service (summary — small payload)
signalctl traces get frontend --lookback 1h --limit 20

# Full Jaeger JSON for a single trace
signalctl traces get frontend --lookback 1h --limit 1 --raw

# By trace ID (always returns raw Jaeger JSON)
signalctl traces trace 975c8ef6b81bd6c87dc2f4518eb63450
```

The summary view (`traces get` without `--raw`) collapses the shape to fit any prompt; reach for `--raw` only when you need every span, tag, and reference.

### Datasources

```sh
signalctl datasources list                    # JSON to stdout
signalctl datasources list --format table     # human-readable table (TTY only)
```

Use this to confirm the UIDs before overriding `GRAFANA_*_UID` or `--*-uid` flags.

## Commands

```sh
signalctl version

signalctl metrics query <promql>         [--time now|5m|ISO|unix]
signalctl metrics range <promql>         [--start 1h] [--end now] [--step 30s]
signalctl metrics series <selector>      [--start 1h] [--end now] [--limit N]
signalctl metrics labels                 [--start 1h] [--end now]
signalctl metrics label-values <name>    [--start 1h] [--end now]

signalctl logs query <logsql>            [--limit N] [--start 1h] [--end now] [--format ndjson|json]

signalctl traces services
signalctl traces get <service>           [--lookback 1h] [--limit N] [--raw]
signalctl traces trace <traceID>

signalctl datasources list               [--format json|table]
```

Global flags inherited by every subcommand: `--server`, `--token`, `--metrics-uid`, `--logs-uid`, `--traces-uid`, `--no-color`.

Every command accepts `--help`; each `--help` page documents its own example, return shape, and notes.

## Output Schemas

All return shapes are stable; treat them as the public API.

**Metrics (instant)** — `[{metric: Record<string,string>, value: [unix_seconds, string]}, ...]`

```json
[{"metric":{"__name__":"vector"},"value":[1788409360,"1"]}]
```

**Metrics (range)** — `[{metric, values: [[unix_seconds, string], ...]}, ...]`

```json
[{"metric":{"http_method":"POST","http_target":"/api/v1/..."},"values":["[1788409300,\"0.42\"]","[1788409330,\"0.45\"]"]}]
```

**Metrics (labels / label-values / series)** — `string[]` / `string[]` / `[{label:value, ...}, ...]`.

**Logs (NDJSON, default)** — one record per line:

```json
{"_time":"2025-01-01T00:00:00Z","_msg":"...","_stream":"{...}","_stream_id":"...","service.name":"...","severity":"..."}
```

Pass `--format json` for a single JSON array instead.

**Traces (summary)** — `[{traceID, rootSpan, spanCount, errorCount}, ...]`:

```json
[{
  "traceID":"975c8ef6b81bd6c87dc2f4518eb63450",
  "rootSpan":{
    "service":"frontend",
    "operation":"db.transaction.rollback",
    "duration_us":1166,
    "startTime":"2026-09-03T03:38:51.622Z",
    "status":"unset"
  },
  "spanCount":2,
  "errorCount":0
}]
```

`status` is derived from OTel `otel.status_code` (`UNSET=0`, `OK=1`, `ERROR=2`) or boolean `error` tag. Multi-root traces return only the first root span (rare; parallel workflows).

**Traces (`--raw`)** — pass-through Jaeger JSON: `[{traceID, spans:[...], processes:{...}}, ...]`.

**Datasources list** — `[{id, uid, name, type, url, isDefault, ...}, ...]`.

## Error Handling

Every failure prints a single JSON object to stderr and exits non-zero. Stack traces are never emitted.

```jsonc
{"error":"auth_error","message":"GRAFANA_TOKEN is not set (export it or pass --token)"}
{"error":"auth_error","message":"grafana rejected credentials (HTTP 401)"}
{"error":"validation_error","message":"unrecognized time value: garbled"}
{"error":"not_found","message":"not found (HTTP 404)"}
{"error":"timeout","message":"request timed out after 30000ms (...)"}
{"error":"network_error","message":"network error: ..."}
{"error":"server_error","message":"grafana upstream error (HTTP 500)","detail":"..."}
{"error":"parse_error","message":"failed to parse JSON response","detail":{"snippet":"..."}}
{"error":"internal_error","message":"..."}
```

Exit codes are stable: `0` on success, `1` on any error.

## Design Decisions

A few choices that shape how this CLI behaves:

- **Server-side filtering by default.** `--start/--end/--limit/--lookback` are pushed into the upstream URL as query parameters. The datasource does the heavy lifting; the CLI never downloads more data than needed.
- **Trace summary by default.** Full Jaeger JSON for a single trace is hundreds of KB. The default summary collapses to a few lines per trace, small enough to embed in any prompt. Pass `--raw` when you need every span.
- **Single-error envelope on stderr.** No mixed stdout/stderr output, no stack traces. Agents can pipe stdout to JSON parsers without worrying about interleaving.
- **No `.env` file loading.** Forces explicit configuration; sidesteps ambiguity about which env file wins.
- **No write operations.** Logs v1 is read-only; we deliberately do not surface the `/insert/logsql/stream` endpoint even though VictoriaLogs has it.

## Development

```sh
npm run dev          # tsdown --watch
npm run typecheck    # tsc --noEmit
npm run lint         # biome check
npm run lint:fix     # biome check --write
npm run format       # biome format --write
npm test             # vitest run (unit tests, ~89% line coverage)
npm run coverage     # vitest run --coverage
INTEGRATION=1 npm test   # add live Grafana e2e (requires GRAFANA_SERVER + GRAFANA_TOKEN)
```

The toolchain is intentionally minimal: `tsdown` for bundling (TypeScript is not involved in build, only type-checking), `vitest` for tests, `biome` for formatting and lint.

## Limitations & Roadmap

**Out of scope (v1):**
- MySQL datasource (`bfjx5wqn3cgzkd`) — the SELECT 1 probe returns 500; payload format needs investigation. Tracked for v1.1.
- `traces operations` endpoint — unsupported on VictoriaTraces. Rely on `traces get` summary output instead.
- Write operations — no log or metric inserts.
- Field projection (`--fields`) — would reduce client-side payload size; deferred to a follow-up.
- Multi-profile credentials — single Grafana instance per invocation.

## License

MIT