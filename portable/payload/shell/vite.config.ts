import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the shell talks to the daemon through this proxy.
// In production the daemon serves the built shell itself, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:7770", changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
