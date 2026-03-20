import axios from 'axios';
import { clearBrowserAuthSession, clearDesktopAuthSession, getStoredToken, hydrateAuthSession } from '@/lib/auth-session';

let errorHandler: ((message: string) => void) | null = null;

export function setHttpErrorHandler(handler: (message: string) => void) {
  errorHandler = handler;
}

const http = axios.create({
  baseURL:
    typeof window !== 'undefined' && window.electronAPI?.runtimeConfig?.apiBaseUrl
      ? window.electronAPI.runtimeConfig.apiBaseUrl
      : process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use(
  async (config) => {
    let token = typeof window !== 'undefined' ? getStoredToken() : null;

    if (!token && typeof window !== 'undefined') {
      const session = await hydrateAuthSession();
      token = session?.token ?? null;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      clearBrowserAuthSession();
      await clearDesktopAuthSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const message = error.response?.data?.message || error.message;
    if (errorHandler) {
      errorHandler(message);
    }
    return Promise.reject(error);
  }
);

export default http;
