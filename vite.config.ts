import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const worker = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
  },
  server: {
    // `pnpm dev:ui` serves the dashboard with hot reload; API and public form
    // requests go to `pnpm dev` (wrangler). The regex keeps `/forms/*` local.
    proxy: {
      "/api": worker,
      "^/f/": worker,
    },
  },
});
