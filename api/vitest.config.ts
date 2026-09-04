import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const shared = fileURLToPath(new URL("../shared/src/index.ts", import.meta.url));
const sharedDomain = fileURLToPath(
  new URL("../shared/src/domain/index.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      "@cuadrilla/shared/domain": sharedDomain,
      "@cuadrilla/shared": shared,
    },
  },
  test: {
    globals: true,
    environment: "node",
    hookTimeout: 120000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
