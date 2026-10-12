// The API's error vocabulary (doc/TOKENS.md, "Error codes"): every error carries a code the app
// branches on, never a message. Over REST the body is { "error": "<code>", "message": "...",
// ...details }; over GraphQL each entry of `errors` carries `extensions.code`, with per-field
// messages under `extensions.fields`. No DOM here, so this tests with node --test.

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'UNAVAILABLE';

/** The REST status each code answers with, which GraphQL errors (always 200) borrow. */
const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID: 422,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
  UNAVAILABLE: 503,
};

export interface GraphQLError {
  message: string;
  extensions?: {
    code?: string;
    fields?: Record<string, string[]>;
    reason?: string;
  };
}

export interface RestErrorBody {
  error?: string;
  message?: string;
  fields?: Record<string, string[]>;
  reason?: string;
}

export class APIError extends Error {
  readonly status: number;
  /** One of the API's codes, or whatever else the server named (graphql-ruby's own, say). */
  readonly code: string | undefined;
  /** Messages by field, on INVALID. */
  readonly fields: Record<string, string[]> | undefined;
  /** Why, on FORBIDDEN (no_permission, banned, wrong_audience, ...). */
  readonly reason: string | undefined;

  constructor(status: number, message: string, code?: string, fields?: Record<string, string[]>, reason?: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.reason = reason;
  }

  /** Nobody is signed in any more: the token was refused or the session ended. */
  get signedOut(): boolean {
    return this.code === 'UNAUTHENTICATED' || this.status === 401;
  }

  get notFound(): boolean {
    return this.code === 'NOT_FOUND' || this.status === 404;
  }

  /** Nothing is wrong with the request; the API or a service it relies on is busy or down. */
  get transient(): boolean {
    return this.code === 'UNAVAILABLE' || this.code === 'RATE_LIMITED' || this.status === 503 || this.status === 429;
  }

  /** Whether the site should report it as its own fault: a server failure that isn't an expected refusal. */
  get reportable(): boolean {
    return !this.transient && (this.code === 'INTERNAL' || (this.code == null && this.status >= 500));
  }
}

function isApiCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && code in STATUS;
}

/** The error for a REST response that wasn't ok. `body` is its JSON when it had any. */
export function restError(method: string, path: string, status: number, body: unknown): APIError {
  const rest = (body && typeof body === 'object' ? body : {}) as RestErrorBody;
  const message = typeof rest.message === 'string' && rest.message ? rest.message : `${method} ${path} failed with ${status}`;
  return new APIError(status, message, typeof rest.error === 'string' ? rest.error : undefined, rest.fields, rest.reason);
}

/** The error for a GraphQL response whose `errors` is non-empty: the first API code wins. */
export function graphqlError(operation: string, errors: GraphQLError[]): APIError {
  const coded = errors.find((e) => isApiCode(e.extensions?.code)) ?? errors.find((e) => e.extensions?.code) ?? errors[0];
  const code = coded?.extensions?.code;
  const status = isApiCode(code) ? STATUS[code] : 500;
  const message = `${operation} failed: ${errors.map((e) => e.message).join(', ')}`;
  return new APIError(status, message, code, coded?.extensions?.fields, coded?.extensions?.reason);
}
