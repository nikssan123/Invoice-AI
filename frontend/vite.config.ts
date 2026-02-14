import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    // Proxy /api to backend so admin session cookie is same-origin (no 401 on /me after login).
    proxy: process.env.VITE_API_URL
      ? undefined
      : {
          "/api": {
            target: process.env.VITE_PROXY_API_TARGET ?? "http://localhost:3001",
            changeOrigin: true,
          },
        },
  },
  preview: {
    allowedHosts: true,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
