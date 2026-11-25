/** Error with an HTTP status and a stable machine-readable code (see docs/API.md "Error format"). */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to access this resource') => new AppError(403, 'FORBIDDEN', message);
/** Used for missing resources AND for resources owned by someone else, so ids cannot be probed. */
export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
export const mlUnavailable = (message = 'The analysis service is currently unavailable. Please try again shortly.') =>
  new AppError(503, 'ML_SERVICE_UNAVAILABLE', message);

/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
