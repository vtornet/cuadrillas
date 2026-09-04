import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const shared = fileURLToPath(new URL("../shared/src/index.ts", import.meta.url));
const sharedDomain = fileURLToPath(
  new URL("../shared/src/domain/index.ts", import.meta.url),
);

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      "@cuadrilla/shared/domain": sharedDomain,
      "@cuadrilla/shared": shared,
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
