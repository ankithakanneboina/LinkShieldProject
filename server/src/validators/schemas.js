import { z } from 'zod';
import { FEEDBACK_CATEGORIES, PREDICTIONS, RISK_CATEGORIES } from '../constants.js';

// ---- shared pieces ------------------------------------------------------------------------------
const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);

const name = z
  .string({ required_error: 'Enter your name', invalid_type_error: 'Name must be text' })
  .trim()
  .min(2, 'Enter at least 2 characters')
  .max(60, 'Use 60 characters or fewer');

const email = z
  .string({ required_error: 'Enter your email address', invalid_type_error: 'Email must be text' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

// bcrypt only uses the first 72 BYTES, so the limit is enforced in bytes, not characters.
const newPassword = z
  .string({ required_error: 'Enter a password', invalid_type_error: 'Password must be text' })
  .min(10, 'Password must be at least 10 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((v) => /[A-Za-z]/.test(v), 'Password must contain at least one letter')
  .refine((v) => /\d/.test(v), 'Password must contain at least one digit');

const page = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100000).default(1));
const limit = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(10));
const search = z.preprocess(emptyToUndefined, z.string().trim().max(200, 'Search text is too long').optional());
const optionalEnum = (values) => z.preprocess(emptyToUndefined, z.enum(values).optional());
const days = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .refine((v) => [7, 30, 90].includes(v), 'range must be 7, 30 or 90')
    .default(30),
);

// ---- auth -------------------------------------------------------------------------------------
export const registerBody = z.object({ name, email, password: newPassword });

export const loginBody = z.object({
  email,
  password: z.string({ required_error: 'Enter your password' }).min(1, 'Enter your password').max(256),
});

export const refreshBody = z.object({ refreshToken: z.string().min(10).max(200).optional() });
export const updateProfileBody = z.object({ name });
export const changePasswordBody = z.object({
  currentPassword: z.string({ required_error: 'Enter your current password' }).min(1, 'Enter your current password').max(256),
  newPassword,
});

// ---- scans ------------------------------------------------------------------------------------
export const scanBody = z.object({
  url: z.string({ required_error: 'URL is required', invalid_type_error: 'URL must be text' }).max(10_000, 'URL is too long'),
});

export const listScansQuery = z.object({
  page,
  limit,
  search,
  prediction: optionalEnum(PREDICTIONS),
  risk: optionalEnum(RISK_CATEGORIES),
  sort: z.preprocess(emptyToUndefined, z.enum(['newest', 'oldest']).default('newest')),
});

export const rangeQuery = z.object({ range: days });

// ---- feedback ---------------------------------------------------------------------------------
export const feedbackBody = z.object({
  scanId: z.string({ required_error: 'scanId is required' }).uuid('scanId must be a valid id'),
  category: z.enum(FEEDBACK_CATEGORIES, { errorMap: () => ({ message: `category must be one of: ${FEEDBACK_CATEGORIES.join(', ')}` }) }),
  comments: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(1000, 'Comments can be at most 1000 characters').optional(),
  ),
});

// ---- admin ------------------------------------------------------------------------------------
export const adminUsersQuery = z.object({ page, limit, search });
export const adminFeedbackQuery = z.object({ page, limit, category: optionalEnum(FEEDBACK_CATEGORIES) });
export const adminActivityQuery = z.object({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(20)),
});
