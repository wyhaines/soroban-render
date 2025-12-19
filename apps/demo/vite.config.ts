import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/soroban-render/",
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
});
