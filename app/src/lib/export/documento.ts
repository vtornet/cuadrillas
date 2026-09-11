import type {
  InformeAsistencia,
  InformeParte,
  InformeParteHoras,
} from "@cuadrilla/shared/domain";
import { fechaES } from "@cuadrilla/shared/domain";
import { i18n } from "../i18n/i18n.svelte";

/**
 * Modelo de documento intermedio para los informes de un parte. Tanto el PDF
 * (`pdf.ts`) como el Excel (`xlsx.ts`) renderizan esta misma estructura, así
 * quedan idénticos: título, cabecera del parte y una o varias tablas con
 * cabecera en negrita y bordes en las celdas con datos.
 */

export type Align = "left" | "center" | "right";

export interface Columna {
  titulo: string;
  /** Peso relativo del ancho de columna. */
  peso: number;
  align: Align;
}

export interface Tabla {
  titulo: string;
  columnas: Columna[];
  /** Cada fila: un valor por columna. */
  filas: (string | number)[][];
  /** Fila de total (opcional), misma forma que `columnas`. */
  total?: (string | number)[];
}

export interface Documento {
  titulo: string;
  /** Pares etiqueta/valor de la cabecera del parte. */
  cabecera: { etiqueta: string; valor: string }[];
  tablas: Tabla[];
  /** Observaciones libres del jefe (bloque de texto tras las tablas). */
  observaciones?: string;
  firmaPng?: string;
  firmante?: string;
}

function camposCabecera(
  c: InformeAsistencia["cabecera"],
): Documento["cabecera"] {
  const finca = i18n.t("jornada.finca").replace(/ \(.*\)$/, "");
  const campos: Documento["cabecera"] = [];
  if (c.empresa) {
    campos.push({ etiqueta: i18n.t("cabecera.empresa"), valor: c.empresa });
  }
  if (c.nif) campos.push({ etiqueta: i18n.t("cabecera.nif"), valor: c.nif });
  campos.push({ etiqueta: i18n.t("jornada.cuadrilla"), valor: c.cuadrilla });
  if (c.finca) campos.push({ etiqueta: finca, valor: c.finca });
  campos.push({ etiqueta: i18n.t("jornada.fecha"), valor: fechaES(c.fecha) });
  if (c.horaInicio) {
    campos.push({
      etiqueta: i18n.t("cabecera.horario"),
      valor: `${c.horaInicio} – ${c.horaFin || "…"}`,
    });
  }
  campos.push({ etiqueta: i18n.t("jornada.producto"), valor: c.producto });
  if (c.unidad) campos.push({ etiqueta: i18n.t("jornada.unidad"), valor: c.unidad });
  if (c.firmante) {
    campos.push({ etiqueta: i18n.t("cabecera.firma_pdf"), valor: c.firmante });
  }
  return campos;
}

const colNum = (): Columna => ({
  titulo: i18n.t("compartir.numero"),
  peso: 8,
  align: "center",
});
const colNombre = (): Columna => ({
  titulo: i18n.t("compartir.trabajador"),
  peso: 60,
  align: "left",
});
const colTotalEtiqueta = (): string =>
  i18n.t("compartir.total").toUpperCase();

export function docAsistencia(inf: InformeAsistencia): Documento {
  const tablas: Tabla[] = [];

  const lista = (titulo: string, nombres: string[]): Tabla => ({
    titulo: `${titulo} (${nombres.length})`,
    columnas: [colNum(), colNombre()],
    filas: nombres.map((n, i) => [i + 1, n]),
  });

  if (inf.recolectores.length > 0) {
    tablas.push(lista(i18n.t("compartir.recolectores"), inf.recolectores));
  }
  if (inf.auxiliares.length > 0) {
    tablas.push(lista(i18n.t("auxiliar.seccion"), inf.auxiliares));
  }

  return {
    titulo: i18n.t("compartir.pdf_titulo_asistencia"),
    cabecera: camposCabecera(inf.cabecera),
    tablas,
    observaciones: inf.cabecera.observaciones?.trim() || undefined,
  };
}

export function docParte(inf: InformeParte): Documento {
  const ud = inf.cabecera.unidad || i18n.t("compartir.unidades");
  const colUnidades: Columna = {
    titulo: `${i18n.t("compartir.unidades")} (${ud})`,
    peso: 20,
    align: "center",
  };
  const tablas: Tabla[] = [];

  tablas.push({
    titulo: `${i18n.t("compartir.recolectores")} (${inf.recolectores.length})`,
    columnas: [colNum(), colNombre(), colUnidades],
    filas: inf.recolectores.map((r, i) => [i + 1, r.nombre, r.unidades]),
    total: ["", colTotalEtiqueta(), inf.totalUnidades],
  });

  if (inf.auxiliares.length > 0) {
    tablas.push({
      titulo: `${i18n.t("auxiliar.seccion")} (${inf.auxiliares.length})`,
      columnas: [
        colNombre(),
        { titulo: i18n.t("compartir.tarea"), peso: 34, align: "left" },
        { titulo: i18n.t("compartir.horas"), peso: 14, align: "center" },
      ],
      filas: inf.auxiliares.map((a) => [a.nombre, a.tarea, a.horas ?? ""]),
    });
  }

  return {
    titulo: i18n.t("compartir.pdf_titulo_parte"),
    cabecera: camposCabecera(inf.cabecera),
    tablas,
    observaciones: inf.cabecera.observaciones?.trim() || undefined,
    firmaPng: inf.cabecera.firmaPng,
    firmante: inf.cabecera.firmante,
  };
}

/** Parte completo en modo "por horas": horas por recolector en vez de unidades. */
export function docParteHoras(inf: InformeParteHoras): Documento {
  const colHoras: Columna = {
    titulo: i18n.t("compartir.horas"),
    peso: 20,
    align: "center",
  };
  const tablas: Tabla[] = [
    {
      titulo: `${i18n.t("compartir.recolectores")} (${inf.recolectores.length})`,
      columnas: [colNum(), colNombre(), colHoras],
      filas: inf.recolectores.map((r, i) => [i + 1, r.nombre, r.horas ?? ""]),
      total: ["", colTotalEtiqueta(), inf.totalHoras],
    },
  ];

  if (inf.auxiliares.length > 0) {
    tablas.push({
      titulo: `${i18n.t("auxiliar.seccion")} (${inf.auxiliares.length})`,
      columnas: [
        colNombre(),
        { titulo: i18n.t("compartir.tarea"), peso: 34, align: "left" },
        { titulo: i18n.t("compartir.horas"), peso: 14, align: "center" },
      ],
      filas: inf.auxiliares.map((a) => [a.nombre, a.tarea, a.horas ?? ""]),
    });
  }

  const cabecera = camposCabecera(inf.cabecera);
  if (inf.totalEnvases != null) {
    cabecera.push({
      etiqueta: i18n.t("horas.total_envases"),
      valor: String(inf.totalEnvases),
    });
  }
  if (inf.mediaEnvases != null) {
    cabecera.push({
      etiqueta: i18n.t("horas.media_etiqueta"),
      valor: String(inf.mediaEnvases),
    });
  }

  return {
    titulo: i18n.t("compartir.pdf_titulo_parte"),
    cabecera,
    tablas,
    observaciones: inf.cabecera.observaciones?.trim() || undefined,
    firmaPng: inf.cabecera.firmaPng,
    firmante: inf.cabecera.firmante,
  };
}
