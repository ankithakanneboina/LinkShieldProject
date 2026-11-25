import { AppError } from '../utils/errors.js';

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

/** Every error leaves the API in the documented shape. Internals (stack traces, SQL) are logged, never returned. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'VALIDATION_ERROR';
    message = 'Request body is too large';
  } else if (err?.code === 'CORS_ORIGIN_DENIED') {
    status = 403;
    code = 'FORBIDDEN';
    message = 'Origin not allowed';
  } else {
    console.error(`[error] ${req.method} ${req.path}:`, err);
  }

  const body = { error: { code, message } };
  if (details) body.error.details = details;
  res.status(status).json(body);
}
