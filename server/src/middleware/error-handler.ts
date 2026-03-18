import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: env.nodeEnv === 'production' ? 'Internal server error' : err.message,
    ...(env.nodeEnv !== 'production' && { stack: err.stack }),
  });
}
