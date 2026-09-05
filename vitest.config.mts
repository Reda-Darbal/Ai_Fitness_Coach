import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure logic only — schemas, progression rules, date maths. Component and
    // route tests would need a DOM environment and are not worth it yet.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
