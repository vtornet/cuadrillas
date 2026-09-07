import type { RegistroSincronizable } from "./base";

export type Idioma = "es" | "ro" | "ar" | "fr" | "en";

/**
 * Función del trabajador en la cuadrilla. `recolector` (o ausente) cobra a
 * destajo por unidad; `auxiliar` hace otras tareas (carga, paletizado, pesaje…)
 * y no recolecta — su trabajo se anota aparte (tarea + horas) en cada parte.
 */
export type FuncionTrabajador = "recolector" | "auxiliar";

export interface Worker extends RegistroSincronizable {
  name: string;
  /** Alias o código corto para buscar y mostrar rápido en campo. */
  alias: string;
  crewId: string;
  language: Idioma;
  activo: 0 | 1;
  /** `auxiliar` = no recolecta. Ausente o `recolector` = destajo normal. */
  funcion?: FuncionTrabajador;
  /** Contenido del QR del trabajador, si tiene. */
  qrCode?: string;
  /**
   * Importe de transporte por día trabajado, en céntimos. `0` o ausente = no se
   * le paga transporte. Se aplica en la liquidación por cada día en que participa.
   */
  transporteCentimos?: number;
}
