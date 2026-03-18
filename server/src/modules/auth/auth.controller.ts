import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as authService from './auth.service';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { displayName, email, password } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      sendError(res, 'Display name is required');
      return;
    }
    if (displayName.trim().length > 100) {
      sendError(res, 'Display name must be 100 characters or less');
      return;
    }

    if (!email || typeof email !== 'string') {
      sendError(res, 'Email is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      sendError(res, 'Invalid email format');
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      sendError(res, 'Password must be at least 8 characters');
      return;
    }
    if (password.length > 128) {
      sendError(res, 'Password must be 128 characters or less');
      return;
    }

    const result = await authService.register({
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    sendSuccess(res, result, 'Registration successful', 201);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const err = error as { status: number; message: string };
      sendError(res, err.message, err.status);
      return;
    }
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      sendError(res, 'Email is required');
      return;
    }
    if (!password || typeof password !== 'string') {
      sendError(res, 'Password is required');
      return;
    }

    const result = await authService.login({
      email: email.trim().toLowerCase(),
      password,
    });

    sendSuccess(res, result);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const err = error as { status: number; message: string };
      sendError(res, err.message, err.status);
      return;
    }
    next(error);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const user = await authService.getProfile(req.user.userId);
    sendSuccess(res, user);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const err = error as { status: number; message: string };
      sendError(res, err.message, err.status);
      return;
    }
    next(error);
  }
}
