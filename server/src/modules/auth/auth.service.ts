import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { JwtPayload } from '../../middleware/auth';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function generateToken(payload: JwtPayload): string {
  // 30 days in seconds
  return jwt.sign(payload, env.jwtSecret, { expiresIn: 30 * 24 * 60 * 60 });
}

function sanitizeUser(user: { id: string; displayName: string; email: string; avatarUrl: string | null; status: number; createdAt: Date }) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw { status: 409, message: 'Email already registered' };
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const id = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      id,
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      updatedAt: new Date(),
    },
  });

  const token = generateToken({ userId: user.id, email: user.email });
  return { token, user: sanitizeUser(user) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw { status: 401, message: 'Invalid email or password' };
  }

  if (user.status !== 0) {
    throw { status: 403, message: 'Account is disabled' };
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw { status: 401, message: 'Invalid email or password' };
  }

  const token = generateToken({ userId: user.id, email: user.email });
  return { token, user: sanitizeUser(user) };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  return sanitizeUser(user);
}
