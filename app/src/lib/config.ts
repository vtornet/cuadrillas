// URL del backend. Vacia = modo demo (sin sincronizacion, datos de ejemplo).
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export const HAY_BACKEND = API_URL.length > 0;
