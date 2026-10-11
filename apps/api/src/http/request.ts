import type { z } from 'zod';
import { ApiError } from './errors';

/** Checks a request body against its schema, or fails with the list of problems. */
export function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError('invalid_request', 'The request is not valid.', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('invalid_request', 'The request body must be JSON.');
  }
}

/** Returns the value if it is one of the allowed ones. */
export function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/** Reads a whole positive number from a path segment, such as an id. */
export function idParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError('not_found', 'There is nothing at this address.');
  }
  return id;
}
