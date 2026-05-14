import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/app", replacement: path.resolve(__dirname, "app") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
      // Pure libs accidentally import `server-only`; in tests we stub it.
      { find: "server-only", replacement: path.resolve(__dirname, "tests/stubs/server-only.ts") },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    globals: false,
  },
});
