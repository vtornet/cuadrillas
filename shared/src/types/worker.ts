import type { RegistroSincronizable } from "./base";

export type Idioma = "es" | "ro" | "ar" | "fr" | "en";

export interface Worker extends RegistroSincronizable {
  name: string;
  /** Alias o código corto para buscar y mostrar rápido en campo. */
  alias: string;
  crewId: string;
  language: Idioma;
  activo: 0 | 1;
  /** Contenido del QR del trabajador, si tiene. */
  qrCode?: string;
  /**
   * Importe de transporte por día trabajado, en céntimos. `0` o ausente = no se
   * le paga transporte. Se aplica en la liquidación por cada día en que participa.
   */
  transporteCentimos?: number;
}
