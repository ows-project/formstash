import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // tokens.test.ts reads the stylesheet's raw text to check contrast.
    css: { include: [/styles\.css/] },
  },
});
