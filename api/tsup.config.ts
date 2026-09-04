import { defineConfig } from "tsup";

// Empaqueta el servidor en un solo archivo ESM con `@cuadrilla/shared` incluido.
// Las dependencias reales (express, mongoose...) quedan externas.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  clean: true,
  noExternal: ["@cuadrilla/shared"],
});
