import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Refresh-token logic — only one in-flight refresh at a time; others wait
let refreshing = false;
const waiters: Array<(token: string | null) => void> = [];

async function doRefresh(): Promise<string | null> {
  const rt = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!rt) return null;
  try {
    // Use a plain axios call (not `api`) to avoid triggering this interceptor again
    const res = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt });
    const token = (res.data?.data?.accessToken ?? res.data?.accessToken) as string | undefined;
    if (token) localStorage.setItem('accessToken', token);
    return token ?? null;
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}

api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config as typeof err.config & { _retry?: boolean };
    if (err?.response?.status !== 401 || orig?._retry) {
      return Promise.reject(err);
    }
    orig._retry = true;

    if (refreshing) {
      // Queue behind the in-flight refresh
      const newToken = await new Promise<string | null>(resolve => waiters.push(resolve));
      if (!newToken) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(err);
      }
      orig.headers = { ...orig.headers, Authorization: `Bearer ${newToken}` };
      return api(orig);
    }

    refreshing = true;
    const newToken = await doRefresh();
    refreshing = false;
    waiters.forEach(fn => fn(newToken));
    waiters.length = 0;

    if (!newToken) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(err);
    }

    orig.headers = { ...orig.headers, Authorization: `Bearer ${newToken}` };
    return api(orig);
  },
);

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAccessToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}
