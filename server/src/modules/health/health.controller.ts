import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';

const startTime = Date.now();

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, {
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}
