# Cuadrilla

PWA para jefes de cuadrilla que trabajan a destajo. Registro en campo **sin cobertura**,
estadísticas y liquidaciones.

## Monorepo

| Paquete | Descripción |
| --- | --- |
| `shared` | Tipos TypeScript y lógica de dominio pura (sin IO): conteos, tarifas, resolución de conflictos de sync y cálculo de liquidaciones. Se usa en cliente y servidor. |
| `app` | PWA. Vite + Svelte 5 + TypeScript, `vite-plugin-pwa`, IndexedDB con Dexie. Funciona 100 % offline. |
| `api` | Backend Express + MongoDB (Mongoose). Enlace magico + `/sync` (LWW). Ver [`api/README.md`](api/README.md). |

## Requisitos

- Node >= 20
- pnpm 9 (`npm i -g pnpm`)

## Arranque

```bash
pnpm install
pnpm dev          # PWA en http://localhost:5173 (modo demo si no hay VITE_API_URL)
pnpm dev:api      # backend en http://localhost:8080 (necesita MongoDB)
pnpm dev:all      # ambos
pnpm test         # tests (Vitest) de shared, app y api
pnpm typecheck
```

Para activar login + sincronización: copia `app/.env.example` a `app/.env` y pon
`VITE_API_URL=http://localhost:8080`; copia `api/.env.example` a `api/.env`.

Sin `VITE_API_URL` la PWA arranca en **modo demo** (datos de ejemplo en el
dispositivo, `app/src/lib/dev/seed.ts`, sin sincronización).

## Estado

MVP completo.

1. ✅ Estructura y esquemas
2. ✅ Modelo local (Dexie) + pantalla de Registro offline
3. ✅ Jornadas (abrir / cerrar)
4. ✅ Gestión (trabajadores, productos, unidades, tarifas)
5. ✅ Sincronización + backend (enlace mágico, `/sync` con LWW)
6. ✅ Estadísticas
7. ✅ Liquidación y exportación (CSV / XLSX / Web Share)
8. ✅ Stripe (Checkout + portal + webhooks; plan → límites de `/sync`)

Pendiente antes de producción: pantalla RGPD (política de privacidad, exportación y
borrado de los datos de un trabajador).

## Despliegue

Ver [`DEPLOY.md`](DEPLOY.md) — PWA en Cloudflare Pages, API en Railway, MongoDB Atlas,
Resend y Stripe, con `cuadrillas.app` como dominio.
