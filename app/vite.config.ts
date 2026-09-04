import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// El paquete `@cuadrilla/shared` se consume como código fuente TypeScript
// (sin paso de build). Se resuelve por alias para que Vite lo transpile.
const shared = fileURLToPath(new URL("../shared/src/index.ts", import.meta.url));
const sharedDomain = fileURLToPath(
  new URL("../shared/src/domain/index.ts", import.meta.url),
);

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,png}"],
        navigateFallback: "index.html",
      },
      // Sin service worker en desarrollo: evita servir assets cacheados y
      // conflictos con HMR. El modo offline se prueba con `pnpm preview`.
      devOptions: { enabled: false },
      manifest: {
        name: "Cuadrilla",
        short_name: "Cuadrilla",
        description:
          "Registro a destajo para jefes de cuadrilla. Funciona sin conexión.",
        lang: "es",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#faf7f0",
        theme_color: "#1c6b3c",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@cuadrilla/shared/domain": sharedDomain,
      "@cuadrilla/shared": shared,
    },
  },
  server: { port: 5173 },
});
