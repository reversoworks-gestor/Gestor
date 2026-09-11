import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: process.env.VITE_GITHUB_PAGES === "true" ? "/Gestor/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  root: "client",
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
