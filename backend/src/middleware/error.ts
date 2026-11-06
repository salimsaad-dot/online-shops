import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { HttpError } from '../lib/errors';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

// Express 5 forwards rejected promises from async handlers here automatically.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message;
    res.status(400).json({ message });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'Invalid JSON body' });
    return;
  }
  const code = (err as { code?: string })?.code;
  if (code === 'P2002') {
    res.status(409).json({ message: 'A record with that value already exists' });
    return;
  }
  if (code === 'P2025') {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
}
