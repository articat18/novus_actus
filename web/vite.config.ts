import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The SPA calls the API under the same-origin `/api` prefix. In development the
// Express server runs separately on PORT (default 3001); Vite proxies `/api` to
// it. In production on Vercel, `/api/*` is served by the serverless function and
// no proxy is involved.
const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
