// Sends uncaught errors, unhandled promise rejections and React error
// boundary catches to the AudienceKit API, which logs each one as a
// [client_error] line (POST /v1/client_errors). Production builds only.
import { API_BASE } from './config';

export type ErrorKind = 'error' | 'unhandledrejection' | 'boundary';

export interface ErrorDetails {
  kind?: ErrorKind;
  component_stack?: string;
  source?: string;
  line?: number;
  column?: number;
}

const ENDPOINT = `${API_BASE}/v1/client_errors`;
// One page that loops on an error shouldn't flood the logs; the API also
// rate-limits each IP.
const MAX_REPORTS_PER_PAGE = 20;
const seen = new Set<string>();
let sent = 0;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error) ?? String(error); } catch { return String(error); }
}

// Never throws, and repeats of the same error are sent once.
export function reportError(error: unknown, details: ErrorDetails = {}): void {
  try {
    if (!import.meta.env.PROD) return;

    const message = errorMessage(error);
    const fingerprint = `${details.kind}:${message}`;
    if (seen.has(fingerprint) || sent >= MAX_REPORTS_PER_PAGE) return;
    seen.add(fingerprint);
    sent += 1;

    const body = JSON.stringify({
      app: 'hotmess.social',
      kind: 'error',
      release: import.meta.env.PUBLIC_RELEASE,
      url: location.href,
      stack: error instanceof Error ? error.stack : undefined,
      ...details,
      message,
    });
    // A text/plain beacon needs no CORS preflight and survives the page unloading.
    if (navigator.sendBeacon?.(ENDPOINT, body)) return;
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
      .catch(() => {});
  } catch {
    // Reporting must never cause an error of its own.
  }
}

let started = false;

export function startErrorReporting(): void {
  if (started) return;
  started = true;
  addEventListener('error', (event) => {
    // Errors from cross-origin scripts (the Facebook SDK, analytics) arrive
    // as "Script error." with nothing useful to report.
    if (!event.error && event.message === 'Script error.') return;
    reportError(event.error ?? event.message, {
      kind: 'error', source: event.filename, line: event.lineno, column: event.colno,
    });
  });
  addEventListener('unhandledrejection', (event) => reportError(event.reason, { kind: 'unhandledrejection' }));
}
