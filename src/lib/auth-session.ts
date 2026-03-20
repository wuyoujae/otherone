'use client';

import { getElectronAPI, isElectron } from '@/lib/electron';
import type { AuthSession } from '@/types/electron';

const AUTH_CHANGED_EVENT = 'otherone-auth-changed';

function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getStoredToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

export function writeBrowserAuthSession(token: string, user: unknown): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  notifyAuthChanged();
}

export function clearBrowserAuthSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  notifyAuthChanged();
}

export async function persistDesktopAuthSession(token: string, user: unknown): Promise<void> {
  if (!isElectron()) {
    return;
  }

  const api = getElectronAPI();
  await api?.invoke('app-auth:set-session', { token, user });
}

export async function clearDesktopAuthSession(): Promise<void> {
  if (!isElectron()) {
    return;
  }

  const api = getElectronAPI();
  await api?.invoke('app-auth:clear-session');
}

export async function hydrateAuthSession(): Promise<AuthSession | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const existingToken = localStorage.getItem('token');
  if (existingToken) {
    return {
      token: existingToken,
      user: (() => {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return null;
        }
      })(),
    };
  }

  if (!isElectron()) {
    return null;
  }

  const api = getElectronAPI();
  const session = await api?.invoke('app-auth:get-session');
  const authSession = session as AuthSession | null;

  if (!authSession?.token) {
    return null;
  }

  writeBrowserAuthSession(authSession.token, authSession.user);
  return authSession;
}

export function onAuthChanged(handler: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
}
