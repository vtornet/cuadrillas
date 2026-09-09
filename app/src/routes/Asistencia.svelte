<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew, Shift, Worker } from "@cuadrilla/shared";
  import { asistenciaMensual } from "@cuadrilla/shared/domain";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { crewsDelForeman } from "../lib/db/repositories/crews";
  import { shiftsDeCuadrillas } from "../lib/db/repositories/shifts";
  import { workersDeCuadrillas } from "../lib/db/repositories/workers";
  import { asistenciaACsv, asistenciaAXlsx } from "../lib/export/asistencia";
  import { compartirArchivo, slug } from "../lib/export/compartir";
  import AppBar from "../lib/components/AppBar.svelte";

  const HOY = new Date();
  const HOY_ISO = HOY.toISOString().slice(0, 10);

  let listo = $state(false);
  let sinCuadrillas = $state(false);
  let crews = $state<Crew[]>([]);
  let workers = $state<Worker[]>([]);
  let shifts = $state<Shift[]>([]);
  let mensaje = $state("");

  let anio = $state(HOY.getFullYear());
  let mes = $state(HOY.getMonth() + 1); // 1..12
  /** "" = todas las cuadrillas. */
  let crewSel = $state("");

  onMount(async () => {
    crews = await crewsDelForeman(sesion.userId);
    const ids = crews.map((c) => c.id);
    if (ids.length === 0) {
      sinCuadrillas = true;
      listo = true;
      return;
    }
    [workers, shifts] = await Promise.all([
      workersDeCuadrillas(ids),
      shiftsDeCuadrillas(ids),
    ]);
    listo = true;
  });

  const crewsUsadas = $derived(crewSel ? crews.filter((c) => c.id === crewSel) : crews);
  const workersFiltrados = $derived(
    crewSel ? workers.filter((w) => w.crewId === crewSel) : workers,
  );
  const shiftsFiltrados = $derived(
    crewSel ? shifts.filter((s) => s.crewId === crewSel) : shifts,
  );

  const tabla = $derived(
    asistenciaMensual(shiftsFiltrados, workersFiltrados, anio, mes),
  );
  const hayRec = $derived(tabla.filas.some((f) => f.funcion === "recolector"));
  const hayAux = $derived(tabla.filas.some((f) => f.funcion === "auxiliar"));
  const primerAux = $derived(tabla.filas.findIndex((f) => f.funcion === "auxiliar"));

  const etiquetaMes = $derived(
    new Date(anio, mes - 1, 1).toLocaleDateString(i18n.locale, {
      month: "long",
      year: "numeric",
    }),
  );

  function cambiarMes(delta: number): void {
    const d = new Date(anio, mes - 1 + delta, 1);
    anio = d.getFullYear();
    mes = d.getMonth() + 1;
    mensaje = "";
  }

  const esMesActual = $derived(
    anio === HOY.getFullYear() && mes === HOY.getMonth() + 1,
  );

  let exportando = $state<"" | "xlsx" | "csv">("");

  const nombreBase = $derived(
    `asistencia_${anio}-${String(mes).padStart(2, "0")}_${slug(crewsUsadas.map((c) => c.name).join("-"))}`,
  );

  async function exportar(formato: "xlsx" | "csv"): Promise<void> {
    if (exportando) return;
    exportando = formato;
    mensaje = "";
    try {
      let blob: Blob;
      if (formato === "csv") {
        blob = new Blob([asistenciaACsv(tabla)], {
          type: "text/csv;charset=utf-8",
        });
      } else {
        blob = await asistenciaAXlsx(tabla, {
          titulo: `${i18n.t("asistencia.titulo")} · ${etiquetaMes}`,
          cuadrillas: crewsUsadas.map((c) => c.name).join(", "),
          etiquetas: {
            trabajador: i18n.t("asistencia.trabajador"),
            total: i18n.t("asistencia.total"),
            totalRecolectores: i18n.t("asistencia.total_recolectores"),
            totalAuxiliares: i18n.t("asistencia.total_auxiliares"),
            fincas: i18n.t("asistencia.fincas"),
          },
        });
      }
      const r = await compartirArchivo(blob, `${nombreBase}.${formato}`);
      mensaje = i18n.t(r === "compartido" ? "export.compartido" : "export.descargado");
    } catch (e) {
      console.error("[asistencia] export", e);
      mensaje = i18n.t("export.error");
    } finally {
      exportando = "";
    }
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("asistencia.titulo")} />
    <div class="mes-nav">
      <button
        type="button"
        class="mes-btn"
        onclick={() => cambiarMes(-1)}
        aria-label={i18n.t("asistencia.mes_anterior")}
      >
        &lsaquo;
      </button>
      <span class="mes-actual">{etiquetaMes}</span>
      <button
        type="button"
        class="mes-btn"
        disabled={esMesActual}
        onclick={() => cambiarMes(1)}
        aria-label={i18n.t("asistencia.mes_siguiente")}
      >
        &rsaquo;
      </button>
    </div>
    {#if crews.length > 1}
      <div class="asis-crew">
        <select bind:value={crewSel} aria-label={i18n.t("jornada.cuadrilla")}>
          <option value="">{i18n.t("historial.todas_cuadrillas")}</option>
          {#each crews as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </div>
    {/if}
  </header>

  <div class="pantalla-cuerpo">
    {#if !listo}
      <p class="vacio-lista">{i18n.t("app.cargando")}</p>
    {:else if sinCuadrillas}
      <p class="vacio-lista">{i18n.t("jornada.sin_cuadrillas")}</p>
    {:else if tabla.totalGeneral === 0}
      <p class="vacio-lista">{i18n.t("asistencia.sin_datos")}</p>
    {:else}
      {#if tabla.fincas.length > 0}
        <p class="asis-fincas">
          {i18n.t("asistencia.fincas")}: {tabla.fincas.join(" · ")}
        </p>
      {/if}
      <div class="asis-scroll">
        <table class="asis-tabla">
          <thead>
            <tr>
              <th class="asis-esq">{i18n.t("asistencia.trabajador")}</th>
              {#each tabla.dias as d (d.dia)}
                <th
                  class:finde={d.finDeSemana}
                  class:hoy={d.fecha === HOY_ISO}
                >
                  {d.dia}
                </th>
              {/each}
              <th class="asis-tot" title={i18n.t("asistencia.total")}>&Sigma;</th>
            </tr>
          </thead>
          <tbody>
            {#each tabla.filas as f, fi (f.workerId)}
              {#if hayRec && hayAux && fi === primerAux}
                <tr class="asis-grupo">
                  <th class="asis-nombre" colspan={tabla.dias.length + 2}>
                    {i18n.t("auxiliar.seccion")}
                  </th>
                </tr>
              {/if}
              <tr>
                <th class="asis-nombre">{f.name}</th>
                {#each f.presente as p, i (i)}
                  <td
                    class:presente={p}
                    class:finde={tabla.dias[i].finDeSemana}
                    class:hoy={tabla.dias[i].fecha === HOY_ISO}
                    title={p
                      ? [f.name, tabla.dias[i].fecha, ...tabla.fincasPorDia[i]].join(
                          " · ",
                        )
                      : ""}
                  ></td>
                {/each}
                <td class="asis-tot">{f.total}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            {#if hayRec && hayAux}
              <tr class="asis-subtotal">
                <th class="asis-nombre">{i18n.t("asistencia.total_recolectores")}</th>
                {#each tabla.totalPorDiaRol.recolector as n, i (i)}
                  <td class:finde={tabla.dias[i].finDeSemana}>{n || ""}</td>
                {/each}
                <td class="asis-tot">
                  {tabla.totalPorDiaRol.recolector.reduce((s, x) => s + x, 0)}
                </td>
              </tr>
              <tr class="asis-subtotal">
                <th class="asis-nombre">{i18n.t("asistencia.total_auxiliares")}</th>
                {#each tabla.totalPorDiaRol.auxiliar as n, i (i)}
                  <td class:finde={tabla.dias[i].finDeSemana}>{n || ""}</td>
                {/each}
                <td class="asis-tot">
                  {tabla.totalPorDiaRol.auxiliar.reduce((s, x) => s + x, 0)}
                </td>
              </tr>
            {/if}
            <tr>
              <th class="asis-nombre">{i18n.t("asistencia.total")}</th>
              {#each tabla.totalPorDia as n, i (i)}
                <td
                  class:finde={tabla.dias[i].finDeSemana}
                  class:hoy={tabla.dias[i].fecha === HOY_ISO}
                >
                  {n || ""}
                </td>
              {/each}
              <td class="asis-tot">{tabla.totalGeneral}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}

    {#if mensaje}
      <p class="asis-msg">{mensaje}</p>
    {/if}
  </div>

  {#if listo && !sinCuadrillas && tabla.totalGeneral > 0}
    <div class="acciones asis-export">
      <button
        type="button"
        class="btn-primario"
        disabled={!!exportando}
        onclick={() => exportar("xlsx")}
      >
        {exportando === "xlsx"
          ? i18n.t("compartir.generando")
          : i18n.t("asistencia.exportar_excel")}
      </button>
      <button
        type="button"
        class="btn-secundario"
        disabled={!!exportando}
        onclick={() => exportar("csv")}
      >
        {exportando === "csv"
          ? i18n.t("compartir.generando")
          : i18n.t("asistencia.exportar_csv")}
      </button>
    </div>
  {/if}
</div>

<style>
  .mes-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 6px 0 2px;
  }
  .mes-btn {
    min-height: var(--tap);
    min-width: var(--tap);
    font-size: 24px;
    line-height: 1;
  }
  .mes-actual {
    font-weight: 700;
    min-width: 10rem;
    text-align: center;
  }
  .mes-actual::first-letter {
    text-transform: uppercase;
  }

  .asis-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
  }
  .asis-tabla {
    border-collapse: collapse;
    font-size: 13px;
  }
  .asis-tabla th,
  .asis-tabla td {
    box-sizing: border-box;
    width: 26px;
    min-width: 26px;
    height: 32px;
    text-align: center;
    border-inline-end: 1px solid var(--c-borde);
    border-bottom: 1px solid var(--c-borde);
  }
  .asis-tabla thead th {
    position: sticky;
    top: 0;
    background: var(--c-superficie);
    font-weight: 700;
    z-index: 1;
  }
  .asis-nombre,
  .asis-esq {
    position: sticky;
    inset-inline-start: 0;
    width: 128px;
    min-width: 128px;
    text-align: start;
    padding: 0 8px;
    background: var(--c-superficie);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 128px;
  }
  .asis-esq {
    z-index: 2;
  }
  tbody .asis-nombre,
  tfoot .asis-nombre {
    z-index: 1;
  }
  .asis-tabla td.presente {
    background: var(--c-primario);
  }
  .asis-tabla .finde {
    background: #f0ece0;
  }
  .asis-tabla td.presente.finde {
    background: var(--c-primario);
  }
  .asis-tabla .hoy {
    outline: 2px solid var(--c-aviso);
    outline-offset: -2px;
  }
  .asis-tabla .asis-tot {
    width: 34px;
    min-width: 34px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .asis-tabla tfoot td,
  .asis-tabla tfoot th {
    font-weight: 700;
    border-top: 2px solid var(--c-borde-fuerte);
    background: var(--c-superficie);
  }

  .asis-msg {
    margin-top: 12px;
    color: var(--c-ok);
    font-weight: 600;
  }
  .asis-crew {
    display: flex;
    justify-content: center;
    padding: 0 0 6px;
  }
  .asis-crew select {
    min-height: var(--tap);
    max-width: 100%;
  }
  .asis-fincas {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--c-texto-suave);
  }
  .asis-tabla tbody tr.asis-grupo th {
    text-align: start;
    background: var(--c-fondo);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--c-texto-suave);
  }
  .asis-tabla tfoot tr.asis-subtotal th,
  .asis-tabla tfoot tr.asis-subtotal td {
    font-weight: 600;
    border-top: 1px solid var(--c-borde);
    background: var(--c-superficie);
  }
  .asis-export {
    display: flex;
    gap: 8px;
  }
  .asis-export button {
    flex: 1;
  }
</style>
