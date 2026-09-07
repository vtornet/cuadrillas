import type {
  InformeAsistencia,
  InformeParte,
} from "@cuadrilla/shared/domain";
import { fechaES } from "@cuadrilla/shared/domain";
import { i18n } from "../i18n/i18n.svelte";

/**
 * Generación de Excel (.xlsx) de los informes de un parte. SheetJS se carga
 * bajo demanda.
 */

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Fila = (string | number)[];

function filasCabecera(c: InformeAsistencia["cabecera"]): Fila[] {
  const f: Fila[] = [
    [i18n.t("jornada.cuadrilla"), c.cuadrilla],
    [i18n.t("jornada.fecha"), fechaES(c.fecha)],
  ];
  if (c.finca) f.splice(1, 0, [i18n.t("jornada.finca").replace(/ \(.*\)$/, ""), c.finca]);
  f.push([i18n.t("jornada.producto"), c.producto]);
  if (c.unidad) f.push([i18n.t("jornada.unidad"), c.unidad]);
  if (c.firmante) f.push([i18n.t("cabecera.firma_pdf"), c.firmante]);
  return f;
}

async function libroABlob(aoas: { nombre: string; filas: Fila[] }[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const { nombre, filas } of aoas) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre);
  }
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([buffer], { type: MIME });
}

export function asistenciaAXlsx(inf: InformeAsistencia): Promise<Blob> {
  const filas: Fila[] = [
    ...filasCabecera(inf.cabecera),
    [],
    [i18n.t("compartir.recolectores")],
    ...inf.recolectores.map((n) => [n]),
  ];
  if (inf.auxiliares.length > 0) {
    filas.push([], [i18n.t("auxiliar.seccion")], ...inf.auxiliares.map((n) => [n]));
  }
  for (const g of inf.grupos) {
    filas.push([], [`${g.nombre} (${g.miembros.length})`], ...g.miembros.map((n) => [n]));
  }
  return libroABlob([{ nombre: i18n.t("compartir.hoja_asistencia"), filas }]);
}

export function parteAXlsx(inf: InformeParte): Promise<Blob> {
  const ud = inf.cabecera.unidad || i18n.t("compartir.unidades");
  const filas: Fila[] = [...filasCabecera(inf.cabecera), []];

  if (inf.grupos.length > 0) {
    filas.push([i18n.t("gestion.grupos"), i18n.t("compartir.unidades"), i18n.t("grupo.miembros_hoy")]);
    for (const g of inf.grupos) {
      filas.push([g.nombre, g.unidades, g.miembros.join(", ")]);
    }
  } else {
    filas.push([i18n.t("compartir.recolectores"), i18n.t("compartir.unidades")]);
    for (const r of inf.recolectores) filas.push([r.nombre, r.unidades]);
  }

  if (inf.auxiliares.length > 0) {
    filas.push(
      [],
      [i18n.t("auxiliar.seccion"), i18n.t("auxiliar.tarea"), i18n.t("auxiliar.horas")],
      ...inf.auxiliares.map((a) => [a.nombre, a.tarea, a.horas ?? ""]),
    );
  }

  filas.push([], [i18n.t("registro.total_jornada"), inf.totalUnidades]);

  return libroABlob([{ nombre: i18n.t("compartir.hoja_parte"), filas }]);
}
