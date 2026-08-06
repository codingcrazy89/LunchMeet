import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Errors the API deliberately exposes to clients.
 *
 * Anything else becomes a 500 with no detail, so an unexpected database error
 * cannot leak schema or query text to a caller.
 */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = (message = "Authentication required.") =>
  new ApiError(401, "unauthorized", message);

/**
 * Used for both "you may not" and "it does not exist".
 *
 * Returning 404 rather than 403 for resources the caller cannot see avoids
 * confirming that a given lunch exists. v1 leaked this far more directly by
 * sending every private lunch to every client and hiding them in the UI.
 */
export const notFound = (message = "Not found.") => new ApiError(404, "not_found", message);

export const forbidden = (message = "You do not have access to this.") =>
  new ApiError(403, "forbidden", message);

export const badRequest = (message: string) => new ApiError(400, "bad_request", message);

export const conflict = (message: string) => new ApiError(409, "conflict", message);

export const suspended = () =>
  new ApiError(
    403,
    "account_suspended",
    "Your account has been suspended pending investigation. Please contact support."
  );
