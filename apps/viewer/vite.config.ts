import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // For GitHub Pages: use repo name (e.g., "/soroban-render/")
  // For local dev or custom domains: use "/" (the default)
  const base = env.VITE_BASE_PATH || "/";

  return {
    plugins: [react()],
    base,
    build: {
      outDir: "dist",
      sourcemap: true,
    },
    define: {
      global: "globalThis",
      "process.env": JSON.stringify({}),
    },
    resolve: {
      alias: {
        buffer: "buffer",
      },
    },
  };
});
