import type { ApiErrorResponse } from '@pwease/shared';
export class RouteError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    public readonly code: ApiErrorResponse['error']['code'], message: string) { super(message); }
}
export function fail(status: RouteError['status'], code: RouteError['code'], message: string): never {
  throw new RouteError(status, code, message);
}
