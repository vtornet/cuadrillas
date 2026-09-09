/**
 * URL del backend. En dev, el API corre en :8080 (`pnpm dev:api`). En
 * producción se pone `VITE_API_URL` (p. ej. https://api.cuadrillas.app).
 */
export const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");
