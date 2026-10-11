/** A normalized RFC 9457 problem. The UI localizes by `code` (messages: errors.<code>). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly fieldErrors: Record<string, { code: string; message: string }>;
  readonly limit?: PlanLimit;
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    code: string;
    detail?: string;
    fieldErrors?: ApiError["fieldErrors"];
    limit?: PlanLimit;
    retryAfter?: number;
  }) {
    super(init.detail ?? init.code);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail;
    this.fieldErrors = init.fieldErrors ?? {};
    this.limit = init.limit;
    this.retryAfter = init.retryAfter;
  }

  get isPlanLimit() {
    return this.code === "plan_limit";
  }
  get isConflict() {
    return this.status === 409;
  }
}

export interface PlanLimit {
  plan: string;
  feature?: string;
  limit?: string;
  max?: number;
  used?: number;
  trial_expired?: boolean;
}

interface Problem {
  code?: string;
  detail?: string;
  errors?: { field: string; code: string; message: string }[];
  limit?: PlanLimit;
}

export function toApiError(response: Response, body: unknown): ApiError {
  const p = (body && typeof body === "object" ? body : {}) as Problem;
  const fieldErrors: ApiError["fieldErrors"] = {};
  for (const e of p.errors ?? []) fieldErrors[e.field] = { code: e.code, message: e.message };
  const retry = Number(response.headers.get("Retry-After"));
  return new ApiError({
    status: response.status,
    code: p.code ?? (response.status >= 500 ? "internal" : "invalid_request"),
    detail: p.detail,
    fieldErrors,
    limit: p.limit,
    retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined,
  });
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
