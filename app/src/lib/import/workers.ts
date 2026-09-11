import type { Crew, Worker } from "@cuadrilla/shared";
import { eurosACentimos } from "../money";

/**
 * Importacion de trabajadores desde Excel (.xlsx/.xls) o CSV.
 *
 * `filasDeArchivo` usa SheetJS bajo demanda para pasar el archivo a una matriz
 * de celdas. `construirWorkers` es puro: mapea cabeceras (sin acentos, sin
 * mayusculas) a campos de `Worker`, valida fila a fila y devuelve los validos
 * mas los errores. Nada de esto toca IndexedDB ni la red.
 */

export interface FilaResultado {
  /** Numero de fila del archivo (1 = cabecera), para ubicar el error. */
  fila: number;
  worker: Worker | null;
  motivo: string | null;
}

export interface ResultadoImport {
  filas: FilaResultado[];
  validos: Worker[];
  errores: FilaResultado[];
}

export interface ContextoImport {
  crews: Crew[];
  /** Trabajadores ya existentes, para detectar alias duplicados. */
  existentes: Worker[];
  organizationId: string;
}

const DIACRITICOS = /[̀-ͯ]/g;

/** Sin acentos, sin espacios sobrantes, en minusculas. */
function norm(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();
}

type Campo = "name" | "alias" | "crew" | "qr" | "transporte" | "activo";

const ALIAS_CABECERA: Record<Campo, string[]> = {
  name: ["nombre", "name", "trabajador", "nombre completo"],
  alias: ["alias", "codigo", "code", "clave", "apodo"],
  crew: ["cuadrilla", "crew", "equipo", "grupo de trabajo"],
  qr: ["qr", "qrcode", "codigo qr", "codigoqr"],
  transporte: [
    "transporte",
    "transport",
    "transporte eur",
    "transporte (eur)",
    "transporte dia",
    "transporte/dia",
  ],
  activo: ["activo", "active", "alta"],
};

const NEGATIVOS = new Set(["no", "0", "false", "inactivo", "baja", "n"]);

/** Localiza la primera fila no vacia como cabecera y mapea columna -> campo. */
function mapearCabeceras(cabecera: unknown[]): Partial<Record<Campo, number>> {
  const mapa: Partial<Record<Campo, number>> = {};
  cabecera.forEach((celda, i) => {
    const n = norm(celda);
    if (!n) return;
    for (const campo of Object.keys(ALIAS_CABECERA) as Campo[]) {
      if (mapa[campo] === undefined && ALIAS_CABECERA[campo].includes(n)) {
        mapa[campo] = i;
      }
    }
  });
  return mapa;
}

/**
 * Convierte una matriz de celdas en trabajadores. La primera fila con contenido
 * se toma como cabecera.
 */
export function construirWorkers(
  matriz: unknown[][],
  ctx: ContextoImport,
): ResultadoImport {
  const filas: FilaResultado[] = [];

  const idxCabecera = matriz.findIndex((f) => f.some((c) => norm(c) !== ""));
  if (idxCabecera === -1) {
    return { filas, validos: [], errores: [] };
  }

  const cols = mapearCabeceras(matriz[idxCabecera]);
  if (cols.name === undefined) {
    const err: FilaResultado = {
      fila: idxCabecera + 1,
      worker: null,
      motivo: 'Falta la columna "Nombre" en la cabecera.',
    };
    return { filas: [err], validos: [], errores: [err] };
  }

  const crewPorNombre = new Map(ctx.crews.map((c) => [norm(c.name), c]));
  const crewUnica = ctx.crews.length === 1 ? ctx.crews[0] : null;

  // alias ya usados por cuadrilla: existentes + los que vamos aceptando.
  const aliasUsados = new Set(
    ctx.existentes
      .filter((w) => w.deleted === 0)
      .map((w) => `${w.crewId}::${norm(w.alias)}`),
  );

  const celda = (f: unknown[], campo: Campo): string => {
    const i = cols[campo];
    return i === undefined ? "" : String(f[i] ?? "").trim();
  };

  for (let r = idxCabecera + 1; r < matriz.length; r++) {
    const f = matriz[r];
    const fila = r + 1;
    if (!f || f.every((c) => norm(c) === "")) continue;

    const name = celda(f, "name");
    if (!name) {
      const res: FilaResultado = { fila, worker: null, motivo: "Falta el nombre." };
      filas.push(res);
      continue;
    }

    const aliasRaw = celda(f, "alias");
    const alias = aliasRaw || name;

    let crewId: string;
    const crewRaw = celda(f, "crew");
    if (crewRaw) {
      const c = crewPorNombre.get(norm(crewRaw));
      if (!c) {
        filas.push({
          fila,
          worker: null,
          motivo: `Cuadrilla "${crewRaw}" no encontrada.`,
        });
        continue;
      }
      crewId = c.id;
    } else if (crewUnica) {
      crewId = crewUnica.id;
    } else {
      filas.push({
        fila,
        worker: null,
        motivo: "Falta la cuadrilla (hay varias, indica cual).",
      });
      continue;
    }

    let transporteCentimos = 0;
    const transRaw = celda(f, "transporte");
    if (transRaw) {
      const c = eurosACentimos(transRaw);
      if (c === null) {
        filas.push({
          fila,
          worker: null,
          motivo: `Transporte "${transRaw}" no es un importe valido.`,
        });
        continue;
      }
      transporteCentimos = c;
    }

    const clave = `${crewId}::${norm(alias)}`;
    if (aliasUsados.has(clave)) {
      filas.push({
        fila,
        worker: null,
        motivo: `Ya hay un trabajador con alias "${alias}" en esa cuadrilla.`,
      });
      continue;
    }
    aliasUsados.add(clave);

    const activoRaw = norm(celda(f, "activo"));
    const activo: 0 | 1 = activoRaw && NEGATIVOS.has(activoRaw) ? 0 : 1;

    const qr = celda(f, "qr");

    const worker: Worker = {
      id: crypto.randomUUID(),
      organizationId: ctx.organizationId,
      name,
      alias,
      crewId,
      activo,
      qrCode: qr || undefined,
      transporteCentimos,
      updatedAt: Date.now(),
      deleted: 0,
    };
    filas.push({ fila, worker, motivo: null });
  }

  return {
    filas,
    validos: filas.filter((x) => x.worker).map((x) => x.worker as Worker),
    errores: filas.filter((x) => x.motivo),
  };
}

/** Lee un .xlsx/.xls/.csv a matriz de celdas. SheetJS se carga bajo demanda. */
export async function filasDeArchivo(file: File): Promise<unknown[][]> {
  const XLSX = (await import("xlsx-js-style")).default;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  if (!hoja) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: "",
  });
}

export async function parsearArchivoWorkers(
  file: File,
  ctx: ContextoImport,
): Promise<ResultadoImport> {
  const matriz = await filasDeArchivo(file);
  return construirWorkers(matriz, ctx);
}
