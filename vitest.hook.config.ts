import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * Konfigurace pro pre-commit / rychlý běh: vynechá soubory pojmenované jako pomalé testy.
 * Přidej např. `foo.slow.test.ts` pro testy, které hook nemá spouštět.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, ".")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000
  }
});
