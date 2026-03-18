import axios from 'axios';

let errorHandler: ((message: string) => void) | null = null;

export function setHttpErrorHandler(handler: (message: string) => void) {
  errorHandler = handler;
}

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
