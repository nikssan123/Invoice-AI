import axios from 'axios';

// Use VITE_API_URL when provided; otherwise default to same-origin (relative URLs)
// This makes the build portable across hosts (Synology, AWS, etc.).
const baseURL = import.meta.env.VITE_API_URL ?? '';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Let the browser set Content-Type (with boundary) for FormData
apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}
