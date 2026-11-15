// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["{app,lib}/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});