export type SignalctlErrorCode =
  | 'auth_error'
  | 'validation_error'
  | 'not_found'
  | 'timeout'
  | 'server_error'
  | 'parse_error'
  | 'network_error'
  | 'internal_error';

export class SignalctlError extends Error {
  readonly code: SignalctlErrorCode;
  readonly detail?: unknown;

  constructor(code: SignalctlErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'SignalctlError';
    this.code = code;
    this.detail = detail;
  }

  toJSON(): { error: SignalctlErrorCode; message: string; detail?: unknown } {
    const out: { error: SignalctlErrorCode; message: string; detail?: unknown } = {
      error: this.code,
      message: this.message
    };
    if (this.detail !== undefined) out.detail = this.detail;
    return out;
  }
}

export function isSignalctlError(e: unknown): e is SignalctlError {
  return e instanceof SignalctlError;
}
