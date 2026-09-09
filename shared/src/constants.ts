export const ROLES = ["owner", "foreman", "worker"] as const;

/** Entidades sincronizables, en orden de dependencia (organizacion primero). */
export const ENTIDADES = [
  "organization",
  "crew",
  "worker",
  "group",
  "finca",
  "product",
  "unitType",
  "rate",
  "shift",
  "entry",
] as const;

export const PLANES = ["free", "foreman", "company", "campaign"] as const;

export const IDIOMAS = ["es", "ro", "ar", "fr", "en"] as const;

/** Idiomas con traducción completa en el MVP. El resto quedan preparados. */
export const IDIOMAS_MVP = ["es", "en"] as const;

/** Límites del plan gratuito. Se validan en el servidor dentro de `/sync`. */
export const LIMITES_PLAN_GRATIS = {
  crews: 1,
  workers: 10,
} as const;
