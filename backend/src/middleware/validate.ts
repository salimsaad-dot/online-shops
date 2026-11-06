import type { Request } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors';

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest('Validation failed', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

export const body = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.body);
export const query = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.query);

/** Parses a positive integer route param like :id. */
export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
}

// Shared field schemas
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');
export const emailSchema = z.email().trim().toLowerCase().max(160);

/** Only http(s) URLs — plain z.url() would also accept javascript: and data: URLs. */
export const httpUrl = z.url({ protocol: /^https?$/ }).max(500);
