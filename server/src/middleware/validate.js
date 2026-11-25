import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const zodDetails = (error) =>
  error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }));

/**
 * Validates and coerces request parts with zod. Parsed values are exposed as `req.valid.body|query`
 * (the raw `req.body`/`req.query` are never trusted by handlers). Unknown body fields are dropped.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    req.valid = {};
    if (schemas.body) req.valid.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) req.valid.query = schemas.query.parse(req.query ?? {});
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Some of the information you entered is not valid', zodDetails(err)));
    }
    return next(err);
  }
};
