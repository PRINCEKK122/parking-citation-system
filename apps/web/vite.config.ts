import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "VITE_");
  return {
    plugins: [react()],
    envDir: "../..",
    server: {
      port: 5173,
      // With mocks off, /api goes to the real API on the same origin as the page,
      // which keeps session cookies first-party.
      proxy: { "/api": env.VITE_API_URL ?? "http://localhost:4000" },
    },
    test: {
      environment: "jsdom",
    },
  };
});
