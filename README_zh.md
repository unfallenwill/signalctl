# signalctl

> 为 AI Agent 与人类设计的 Grafana 指标、日志、链路追踪 CLI。

从终端查询 Grafana，结果可直接贴入 prompt。每个响应都是结构化 JSON 且 schema 稳定；错误以统一信封写到 stderr。

- **三类遥测，一个 CLI** —— 指标（VictoriaMetrics 上的 PromQL）、日志（VictoriaLogs 上的 LogsQL）、追踪（VictoriaTraces 的 Jaeger 协议）
- **服务端过滤** —— PromQL/LogsQL/jaeger 查询参数直接传给数据源；CLI 永不拉多余内容
- **追踪默认走 summary** —— 完整 Jaeger JSON 动辄数百 KB；默认输出 `{traceID, rootSpan, spanCount, errorCount}` 形状，能塞进任何 LLM 上下文
- **严格、可解析的错误信封** —— 任何失败都非零退出并在 stderr 打印 `{"error": "<code>", "message": "..."}`；不输出堆栈

## 安装

```sh
npm install
npm run build
```

构建产物为 `dist/index.mjs`。需要 Node.js 18+。

```sh
# 直接运行
node dist/index.mjs --help

# 或全局暴露
npm link   # 之后任意路径可直接用 `signalctl`
```

## 快速上手

```sh
export GRAFANA_SERVER=https://grafana.example.com
export GRAFANA_TOKEN=glsa_xxx...

# 哪些服务在发 trace？
signalctl traces services
# ["frontend","backend"]

# 最近一小时最慢的 trace
signalctl traces get frontend --lookback 1h --limit 5

# 某个服务的 ERROR 日志
signalctl logs query 'severity:ERROR AND service.name:frontend' --limit 10

# 按端点 QPS
signalctl metrics query \
  'sum by (http_method, http_target) (rate(http_server_request_size_bytes_count[5m]))' \
  --time now
```

## 配置

两个必需环境变量：

|变量 | 必需 | 示例 |
|---|---|---|
| `GRAFANA_SERVER` | 是 | `https://grafana.example.com` |
| `GRAFANA_TOKEN` | 是 | `glsa_xxx...`（Grafana 服务账号 token） |

可选 UID 默认值（指向 `grafana.example.com` 栈；需要切到其他实例时覆盖）：

|变量 | 默认 | 数据源 |
|---|---|---|
| `GRAFANA_METRICS_UID` | `P4169E866C3094E38` | VictoriaMetrics |
| `GRAFANA_LOGS_UID` | `PD775F2863313E6C7` | VictoriaLogs |
| `GRAFANA_TRACES_UID` | `P14D5514F5CCC0D1C` | VictoriaTraces（Jaeger） |

每个子命令也接受 `--server`、`--token`、`--metrics-uid`、`--logs-uid`、`--traces-uid` 作为本次调用的覆盖。**不读** `.env` 文件——直接 `export` 到 shell。

## 用法

每个命令成功时 stdout 输出 JSON（NDJSON 一行一条，或数组），退出码 0。错误以 JSON 信封写到 stderr，退出码非零。

### 指标

```sh
# 即时 PromQL 查询
signalctl metrics query 'vector(1)' --time now
signalctl metrics query 'up' --time now

# 最近一小时的范围查询
signalctl metrics range 'rate(http_server_request_size_bytes_count[5m])' \
  --start 1h --end now --step 30s

# 列出所有指标名（用 `__name__` 这个 label）
signalctl metrics label-values __name__

# 列出时间窗内出现的 label 名
signalctl metrics labels --start 1h --end now

# 列出匹配的 series（重——尽量收窄 selector）
signalctl metrics series '{http_method="POST",service_name="backend"}' \
  --start 1h --limit 50
```

### 日志

```sh
# 最近的全部（NDJSON，每行一条记录）
signalctl logs query '*' --limit 100 --start 1h

# 改用单个 JSON 数组输出
signalctl logs query '*' --limit 100 --format json

# 某服务的 ERROR 日志
signalctl logs query 'severity:ERROR AND service.name:frontend' --limit 10

# 在 _msg 上做子串匹配
signalctl logs query 'connection' --limit 20
```

常用 LogsQL 字段（自动从 `_stream` 抽取）：`severity`、`service.name`、`code.file.path`、`http.method`、`http.status_code`。完整说明见 `signalctl logs query --help`。

### 追踪

```sh
# 列出在发 trace 的服务
signalctl traces services

# 某服务的近期 trace（summary，payload 小）
signalctl traces get frontend --lookback 1h --limit 20

# 单条 trace 的完整 Jaeger JSON
signalctl traces get frontend --lookback 1h --limit 1 --raw

# 按 trace ID 取（始终返回 raw Jaeger JSON）
signalctl traces trace 975c8ef6b81bd6c87dc2f4518eb63450
```

summary 视图（不带 `--raw` 的 `traces get`）把形状压到几行，能塞进任何 prompt；只有需要每个 span/tag/reference 时才加 `--raw`。

### 数据源

```sh
signalctl datasources list                    # stdout 输出 JSON
signalctl datasources list --format table     # 人类可读表格（仅 TTY）
```

覆盖 `GRAFANA_*_UID` 或 `--*-uid` 之前，先用它确认 UID。

## 命令清单

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

所有子命令继承的全局参数：`--server`、`--token`、`--metrics-uid`、`--logs-uid`、`--traces-uid`、`--no-color`。

每个命令都支持 `--help`；对应页面里有该命令的示例、返回 schema 和备注。

## 输出 Schema

所有返回形状都是稳定的，可视为公共 API。

**指标（即时）** —— `[{metric: Record<string,string>, value: [unix_seconds, string]}, ...]`

```json
[{"metric":{"__name__":"vector"},"value":[1788409360,"1"]}]
```

**指标（范围）** —— `[{metric, values: [[unix_seconds, string], ...]}, ...]`

**指标（labels / label-values / series）** —— 分别为 `string[]` / `string[]` / `[{label:value, ...}, ...]`。

**日志（NDJSON，默认）** —— 每行一条记录：

```json
{"_time":"2025-01-01T00:00:00Z","_msg":"...","_stream":"{...}","_stream_id":"...","service.name":"...","severity":"..."}
```

加 `--format json` 改为单个 JSON 数组。

**追踪（summary）** —— `[{traceID, rootSpan, spanCount, errorCount}, ...]`：

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

`status` 由 OTel `otel.status_code`（`UNSET=0`、`OK=1`、`ERROR=2`）或布尔 `error` tag 推导；多根 trace 只展示第一个 root span（罕见；并行工作流）。

**追踪（`--raw`）** —— ——透传 Jaeger JSON：`[{traceID, spans:[...], processes:{...}}, ...]`。

**datasources list** —— `[{id, uid, name, type, url, isDefault, ...}, ...]`。

## 错误处理

任何失败都向 stderr 打印一个 JSON 对象并退出非零。绝不输出堆栈。

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

退出码稳定：`0` 成功，`1` 任何错误。

## 设计决策

几个塑造行为的选择：

- **默认服务端过滤**。`--start/--end/--limit/--lookback` 直接拼到上游 URL 作为查询参数。数据源干重活；CLI 永远不下载多余数据。
- **追踪默认 summary**。单条 trace 的完整 Jaeger JSON 几百 KB；默认 summary 压成几行，能塞进任何 prompt。需要每个 span 时加 `--raw`。
- **单一错误信封写 stderr**。stdout/stderr 不混用，不输出堆栈。Agent 把 stdout 喂给 JSON 解析器时不用担心交错。
- **不读 `.env` 文件**。强制显式配置，避免"哪个 env 文件生效"的歧义。
- **无写操作**。Logs v1 只读；即使 VictoriaLogs 有 `/insert/logsql/stream`，我们也刻意不暴露。

## 开发

```sh
npm run dev          # tsdown --watch
npm run typecheck    # tsc --noEmit
npm run lint         # biome check
npm run lint:fix     # biome check --write
npm run format       # biome format --write
npm test             # vitest run（单测，约 89% 行覆盖）
npm run coverage     # vitest run --coverage
INTEGRATION=1 npm test   # 加真线 e2e（需 GRAFANA_SERVER + GRAFANA_TOKEN）
```

工具链刻意精简：`tsdown` 打包（TypeScript 不参与打包，只做类型检查），`vitest` 测试，`biome` 格式化 + lint。

## 限制 & 路线图

**v1 不覆盖：**
- MySQL 数据源（`bfjx5wqn3cgzkd`）—— SELECT 1 探测返回 500；payload 格式待查。v1.1 处理。
- `traces operations` 端点 —— VictoriaTraces 不支持。改用 `traces get` summary。
- 写操作 —— 不支持 insert 日志或指标。
- 字段投影（`--fields`）—— 能减客户端 payload 大小；后续再加。
- 多 profile 凭据 —— 单次调用只支持一个 Grafana 实例。

## 许可证

MIT