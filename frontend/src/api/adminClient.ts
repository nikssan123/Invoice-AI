import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '';
const ADMIN_TOKEN_KEY = 'adminToken';

/** Get stored admin JWT or null. */
export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

/** Set admin JWT (e.g. after login). */
export function setAdminToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    adminClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    delete adminClient.defaults.headers.common['Authorization'];
  }
}

/** Axios instance for admin API; sends JWT in Authorization header. */
export const adminClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

adminClient.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
