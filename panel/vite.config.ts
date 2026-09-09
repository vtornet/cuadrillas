import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// `@cuadrilla/shared` se consume como código fuente (sin build), igual que en
// `app/`. El panel es una SPA online: sin service worker, sin IndexedDB.
const shared = fileURLToPath(new URL("../shared/src/index.ts", import.meta.url));
const sharedDomain = fileURLToPath(
  new URL("../shared/src/domain/index.ts", import.meta.url),
);

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@cuadrilla/shared/domain": sharedDomain,
      "@cuadrilla/shared": shared,
    },
  },
  server: { port: 5175 },
});
