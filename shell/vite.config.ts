import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the shell talks to the daemon through this proxy.
// In production the daemon serves the built shell itself, so no proxy is needed.
const daemonPort = process.env.NODEOS_PORT ?? "7770";
const daemon = process.env.NODEOS_URL ?? `http://127.0.0.1:${daemonPort}`;
const devPort = Number(process.env.VITE_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    port: devPort,
    proxy: {
      "/api": { target: daemon, changeOrigin: true },
      "/door": { target: daemon, changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
