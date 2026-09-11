// URL del backend. Vacia = modo demo (sin sincronizacion, datos de ejemplo).
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export const HAY_BACKEND = API_URL.length > 0;

// URL del panel de empresa (paquete `panel/`, deploy aparte). Fija por
// defecto al dominio de produccion; VITE_PANEL_URL la sobreescribe si hiciera
// falta (entornos locales/staging).
export const PANEL_URL = (
  import.meta.env.VITE_PANEL_URL ?? "https://panel.cuadrillas.app"
).replace(/\/+$/, "");
