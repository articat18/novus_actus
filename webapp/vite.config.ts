import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isTest = mode === "test";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: isTest ? 5273 : 5173,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${isTest ? 3101 : 3001}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
    },
  };
});
