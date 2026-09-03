export interface CommandExample {
  summary: string;
  example: string;
}

export interface CommandReturns {
  type: 'json-array' | 'ndjson' | 'string-array' | 'json-object';
  fields: string;
}

export interface CommandDoc {
  example?: string;
  returns?: CommandReturns;
  notes?: string;
}

const DOCS: Record<string, CommandDoc> = {
  'metrics/query': {
    example: `'vector(1)'  # scalar
up                       # gauge
'rate(http_server_request_size_bytes_count[5m])'`,
    returns: {
      type: 'json-array',
      fields: '[{metric:{<labels>}, value:[<unix_seconds>,"<value>"]}, ...]'
    },
    notes:
      'Time accepted by --time: now | 5m | 1h | 24h | 7d | ISO 8601 | unix seconds (10/13 digits).'
  },
  'metrics/range': {
    example: `'rate(http_server_duration_milliseconds_count[5m])' --start 1h --step 30s`,
    returns: {
      type: 'json-array',
      fields: '[{metric:{<labels>}, values:[[<unix_seconds>,"<value>"], ...]}, ...]'
    },
    notes: 'Step accepts: 30s, 5m, 1h, 2d. Output condensed by server-side aggregation.'
  },
  'metrics/series': {
    example: `'{http_method="POST"}' --start 1h --limit 5`,
    returns: {
      type: 'json-array',
      fields: '[{<label>: "<value>", ...}, ...]'
    },
    notes: 'Use {} empty selector to list every series (heavy).'
  },
  'metrics/labels': {
    example: `--start 1h --end now`,
    returns: { type: 'string-array', fields: '["__name__", "service_name", "http_method", ...]' }
  },
  'metrics/label-values': {
    example: `'__name__'  # list all metric names
'service_name'`,
    returns: { type: 'string-array', fields: '["frontend", "backend", ...]' },
    notes:
      'The label "__name__" yields metric names. Other common labels: service_name, http_method.'
  },
  'logs/query': {
    example: `'*'                                           # all
'error'                                      # substring in _msg
'_stream:{service.name="frontend"}'   # by service
'severity:ERROR'                              # exact field value
'severity:ERROR AND service.name:frontend'  # combined`,
    returns: {
      type: 'ndjson',
      fields: '{_time, _msg, _stream, _stream_id, severity, service.name, ...} per line'
    },
    notes:
      'LogsQL fields are auto-extracted from _stream. Common: severity, service.name, code.file.path. Pass --format json for a single JSON array (instead of NDJSON).'
  },
  'traces/services': {
    example: '(no args)',
    returns: { type: 'string-array', fields: '["frontend", "backend"]' }
  },
  'traces/get': {
    example: `'frontend' --lookback 1h --limit 5            # summary
'frontend' --lookback 1h --limit 1 --raw   # full Jaeger JSON`,
    returns: {
      type: 'json-array',
      fields:
        '[{traceID, rootSpan:{service,operation,duration_us,startTime,status:ok|error|unset}, spanCount, errorCount}, ...]'
    },
    notes:
      'status derived from tags: otel.status_code (UNSET=0 / OK=1 / ERROR=2), error:bool. --raw returns full Jaeger JSON with spans[]/processes{}. Multi-root traces return only the first root span in rootSpan (rare; parallel workflows).'
  },
  'traces/trace': {
    example: `'b7377bef6c97e4bebe2cacefe372376c'`,
    returns: { type: 'json-array', fields: '[{traceID, spans:[...], processes:{...}}, ...]' },
    notes: 'Always returns full Jaeger JSON; single-element array (or empty).'
  },
  'datasources/list': {
    example: '--format json     # default since v0.1 (use --format table for a human view)',
    returns: {
      type: 'json-array',
      fields: '[{id, uid, name, type, url, isDefault}, ...]'
    },
    notes: 'Useful first step to discover datasource UIDs before overriding via --metricsUid etc.'
  },
  version: {
    example: '(no args)',
    returns: { type: 'json-object', fields: '{name, version}' }
  }
};

export function getDoc(path: string): CommandDoc | undefined {
  return DOCS[path];
}

export function commandPath(parts: string[]): string {
  return parts.filter(Boolean).join('/');
}
