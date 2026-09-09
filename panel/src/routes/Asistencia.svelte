<script lang="ts">
  import type { Crew } from "@cuadrilla/shared";
  import type { AsistenciaMensual } from "@cuadrilla/shared/domain";
  import { get } from "../lib/api";
  import { descargar, slug } from "../lib/export/descargar";
  import { tablaACsv, tablaAXlsx, type Tabla } from "../lib/export/tabla";

  const HOY = new Date();
  const HOY_ISO = HOY.toISOString().slice(0, 10);

  let anio = $state(HOY.getFullYear());
  let mes = $state(HOY.getMonth() + 1);
  let crewId = $state("");

  let crews = $state<Crew[]>([]);
  let tabla = $state<AsistenciaMensual | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    get<Crew[]>("/cuadrillas").then((c) => (crews = c)).catch(() => {});
  });

  let t: ReturnType<typeof setTimeout>;
  $effect(() => {
    anio;
    mes;
    crewId;
    clearTimeout(t);
    t = setTimeout(cargar, 120);
  });

  async function cargar(): Promise<void> {
    tabla = null;
    error = null;
    try {
      tabla = await get<AsistenciaMensual>("/asistencia", {
        anio,
        mes,
        crewId: crewId || undefined,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  function cambiarMes(d: number): void {
    const nd = new Date(anio, mes - 1 + d, 1);
    anio = nd.getFullYear();
    mes = nd.getMonth() + 1;
  }

  const etiquetaMes = $derived(
    new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    }),
  );
  const esMesActual = $derived(
    anio === HOY.getFullYear() && mes === HOY.getMonth() + 1,
  );
  const hayRec = $derived(
    !!tabla?.filas.some((f) => f.funcion === "recolector"),
  );
  const hayAux = $derived(
    !!tabla?.filas.some((f) => f.funcion === "auxiliar"),
  );
  const primerAux = $derived(
    tabla?.filas.findIndex((f) => f.funcion === "auxiliar") ?? -1,
  );

  function tablaExport(): Tabla {
    const a = tabla!;
    const cuad = crews.find((c) => c.id === crewId)?.name ?? "Todas las cuadrillas";
    return {
      titulo: "Asistencia",
      meta: [
        `Mes: ${etiquetaMes}`,
        `Cuadrilla: ${cuad}`,
        a.fincas.length ? `Fincas: ${a.fincas.join(" · ")}` : "",
        "X = presente y anotó · · = presente sin anotar",
      ].filter(Boolean),
      cabeceras: ["Trabajador", ...a.dias.map((d) => String(d.dia)), "Total"],
      filas: a.filas.map((f) => [
        f.name,
        ...f.presente.map((p, i) => (p ? (f.conAnotacion[i] ? "X" : "·") : "")),
        f.total,
      ]),
      total: ["Total", ...a.totalPorDia.map((n) => n || ""), a.totalGeneral],
    };
  }

  let generando = $state<string | null>(null);
  async function exportar(fmt: "csv" | "xlsx"): Promise<void> {
    if (!tabla || generando) return;
    generando = fmt;
    try {
      const t = tablaExport();
      const blob = fmt === "csv" ? tablaACsv(t) : await tablaAXlsx(t);
      descargar(blob, `asistencia_${anio}-${String(mes).padStart(2, "0")}.${fmt}`);
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al exportar";
    } finally {
      generando = null;
    }
  }
</script>

<h1>Asistencia</h1>

<div class="filtros">
  <button type="button" onclick={() => cambiarMes(-1)}>‹</button>
  <span style="min-width:11rem;text-align:center;text-transform:capitalize">
    {etiquetaMes}
  </span>
  <button type="button" disabled={esMesActual} onclick={() => cambiarMes(1)}>›</button>
  <select bind:value={crewId}>
    <option value="">Todas las cuadrillas</option>
    {#each crews as c (c.id)}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
</div>

{#if error}
  <p class="aviso">{error}</p>
{:else if !tabla}
  <p class="cargando">Cargando…</p>
{:else if tabla.totalGeneral === 0}
  <p class="vacio">Sin asistencia este mes.</p>
{:else}
  {#if tabla.fincas.length > 0}
    <p style="color:var(--suave);font-size:13px">
      Fincas: {tabla.fincas.join(" · ")}
    </p>
  {/if}
  <p style="display:flex;gap:8px">
    <button type="button" disabled={!!generando} onclick={() => exportar("xlsx")}>
      {generando === "xlsx" ? "…" : "Excel"}
    </button>
    <button type="button" disabled={!!generando} onclick={() => exportar("csv")}>
      {generando === "csv" ? "…" : "CSV"}
    </button>
  </p>
  <div class="tabla-wrap">
    <table class="datos asis">
      <thead>
        <tr>
          <th class="nom">Trabajador</th>
          {#each tabla.dias as d (d.dia)}
            <th
              class:finde={d.finDeSemana}
              class:hoy={d.fecha === HOY_ISO}
            >
              {d.dia}
            </th>
          {/each}
          <th>Σ</th>
        </tr>
      </thead>
      <tbody>
        {#each tabla.filas as f, fi (f.workerId)}
          {#if hayRec && hayAux && fi === primerAux}
            <tr class="sep">
              <td class="nom" colspan={tabla.dias.length + 2}>Auxiliares</td>
            </tr>
          {/if}
          <tr>
            <td class="nom">{f.name}</td>
            {#each f.presente as p, i (i)}
              <td
                class:pres={p}
                class:sinanot={p && !f.conAnotacion[i]}
                class:finde={tabla.dias[i].finDeSemana}
              >{p && !f.conAnotacion[i] ? "·" : ""}</td>
            {/each}
            <td class="tot">{f.total}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td class="nom">Total</td>
          {#each tabla.totalPorDia as n, i (i)}
            <td class:finde={tabla.dias[i].finDeSemana}>{n || ""}</td>
          {/each}
          <td class="tot">{tabla.totalGeneral}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p style="color:var(--suave);font-size:13px;margin-top:8px">
    Celda rellena = presente y anotó · aro con «·» = presente sin anotar
    {#if tabla.totalSinAnotar > 0}({tabla.totalSinAnotar}){/if}
  </p>
{/if}

<style>
  table.asis th,
  table.asis td {
    text-align: center;
    min-width: 26px;
    padding: 4px;
  }
  table.asis .nom {
    text-align: left;
    position: sticky;
    left: 0;
    background: var(--superficie);
    white-space: nowrap;
  }
  table.asis td.pres {
    background: var(--verde);
  }
  table.asis td.sinanot {
    background: transparent;
    box-shadow: inset 0 0 0 3px var(--verde);
    color: var(--verde);
    font-weight: 700;
  }
  table.asis .finde {
    background: #eef0ec;
  }
  table.asis td.pres.finde {
    background: var(--verde);
  }
  table.asis .hoy {
    outline: 2px solid #b54708;
    outline-offset: -2px;
  }
  table.asis .tot {
    font-weight: 700;
  }
  table.asis tr.sep td {
    text-align: left;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--suave);
    background: var(--fondo);
  }
  table.asis tfoot td {
    font-weight: 700;
    border-top: 2px solid var(--linea);
  }
</style>
