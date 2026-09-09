import type { RegistroSincronizable } from "./base";

export type Idioma = "es" | "ro" | "ar" | "fr" | "en";

/**
 * Función del trabajador en la cuadrilla. `recolector` (o ausente) cobra a
 * destajo por unidad; `auxiliar` hace otras tareas (carga, paletizado, pesaje…)
 * y no recolecta — su trabajo se anota aparte (tarea + horas) en cada parte.
 */
export type FuncionTrabajador = "recolector" | "auxiliar";

/**
 * Datos laborales del trabajador para el alta y el pago. Los **gestiona la
 * empresa desde el panel**, no el jefe de cuadrilla en la PWA de campo. Todo
 * opcional: el jefe da de alta al trabajador "rápido" (nombre + alias +
 * cuadrilla) y la empresa completa esto después. Se borra al anonimizar (RGPD).
 */
export interface DatosLaborales {
  /** DNI / NIE. */
  dni?: string;
  /** Número de afiliación a la Seguridad Social. */
  numAfiliacionSS?: string;
  /** IBAN para el pago. */
  iban?: string;
  /** Fecha de alta (ISO `YYYY-MM-DD`). */
  fechaAlta?: string;
  /** Fecha de baja (ISO `YYYY-MM-DD`). Ausente = sigue de alta. */
  fechaBaja?: string;
  /** Tipo de contrato (texto libre: "eventual", "fijo discontinuo"…). */
  tipoContrato?: string;
  /** Categoría o grupo profesional (texto libre). */
  categoria?: string;
}

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
  /** Datos laborales para alta/pago. Los gestiona la empresa (panel), no el jefe. */
  laboral?: DatosLaborales;
}
