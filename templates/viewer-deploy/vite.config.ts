import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // For GitHub Pages: use repo name (e.g., "/my-blog/")
  // For custom domains or Vercel/Netlify: use "/"
  const base = env.VITE_BASE_PATH || "/";

  return {
    plugins: [react()],
    base,
    build: {
      outDir: "dist",
      sourcemap: false,
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
