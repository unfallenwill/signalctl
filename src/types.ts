export interface FlatMetric {
  metric: Record<string, string>;
  value: [number, string];
}

export interface FlatRangeSeries {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

export interface FlatLogRecord {
  _time: string;
  _msg: string;
  _stream?: string;
  _stream_id?: string;
  [key: string]: unknown;
}

export interface TraceSummary {
  traceID: string;
  rootSpan: {
    service: string;
    operation: string;
    duration_us: number;
    startTime: string;
    status: 'ok' | 'error' | 'unset';
  } | null;
  spanCount: number;
  errorCount: number;
}

export interface VmQueryResponse {
  status: 'success' | 'error';
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string';
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
  errorType?: string;
  error?: string;
}

export interface VmLabelsResponse {
  status: 'success' | 'error';
  data: string[];
  errorType?: string;
  error?: string;
}

export interface VmSeriesResponse {
  status: 'success' | 'error';
  data: Array<Record<string, string>>;
  errorType?: string;
  error?: string;
}

export interface JaegerServicesResponse {
  data: string[];
  total: number;
  limit: number;
  offset: number;
  errors: unknown;
}

export interface JaegerTracesResponse {
  data: JaegerTrace[];
  total: number;
  limit: number;
  offset: number;
}

export interface JaegerTrace {
  traceID: string;
  spans: JaegerSpan[];
  processes: Record<string, { serviceName: string; tags?: Array<{ key: string; value: unknown }> }>;
  warnings?: unknown;
}

export interface JaegerSpan {
  traceID: string;
  spanID: string;
  operationName: string;
  references: Array<{ refType: 'CHILD_OF' | 'FOLLOWS_FROM'; traceID: string; spanID: string }>;
  startTime: number;
  duration: number;
  tags: Array<{ key: string; type?: string; value: unknown }>;
  logs?: Array<{
    timestamp: number;
    fields: Array<{ key: string; type?: string; value: unknown }>;
  }>;
  processID: string;
  warnings?: unknown;
}

export interface DatasourceSummary {
  id: number;
  uid: string;
  name: string;
  type: string;
  url?: string;
  access?: string;
  isDefault?: boolean;
}

export interface GrafanaDatasourcesResponse {
  id: number;
  uid: string;
  name: string;
  type: string;
  url?: string;
  access?: string;
  isDefault?: boolean;
  database?: string;
}
