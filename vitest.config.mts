import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // the comparisons with the old pages read 28 Oct's European Portuguese words
    setupFiles: ["tests/setup/european-portuguese.ts"],
    environment: "node",
  },
});
