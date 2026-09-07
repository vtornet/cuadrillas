<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew, Shift, Worker } from "@cuadrilla/shared";
  import { asistenciaMensual } from "@cuadrilla/shared/domain";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { crewsDelForeman } from "../lib/db/repositories/crews";
  import { shiftsDeCuadrillas } from "../lib/db/repositories/shifts";
  import { workersDeCuadrillas } from "../lib/db/repositories/workers";
  import { asistenciaACsv } from "../lib/export/asistencia";
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

  const tabla = $derived(asistenciaMensual(shifts, workers, anio, mes));

  const etiquetaMes = $derived(
    new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", {
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

  async function exportar(): Promise<void> {
    mensaje = "";
    try {
      const blob = new Blob([asistenciaACsv(tabla)], {
        type: "text/csv;charset=utf-8",
      });
      const r = await compartirArchivo(
        blob,
        `asistencia_${anio}-${String(mes).padStart(2, "0")}_${slug(crews.map((c) => c.name).join("-"))}.csv`,
      );
      mensaje = i18n.t(r === "compartido" ? "export.compartido" : "export.descargado");
    } catch (e) {
      console.error("[asistencia] export", e);
      mensaje = i18n.t("export.error");
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
  </header>

  <div class="pantalla-cuerpo">
    {#if !listo}
      <p class="vacio-lista">{i18n.t("app.cargando")}</p>
    {:else if sinCuadrillas}
      <p class="vacio-lista">{i18n.t("jornada.sin_cuadrillas")}</p>
    {:else if tabla.totalGeneral === 0}
      <p class="vacio-lista">{i18n.t("asistencia.sin_datos")}</p>
    {:else}
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
            {#each tabla.filas as f (f.workerId)}
              <tr>
                <th class="asis-nombre">{f.name}</th>
                {#each f.presente as p, i (i)}
                  <td
                    class:presente={p}
                    class:finde={tabla.dias[i].finDeSemana}
                    class:hoy={tabla.dias[i].fecha === HOY_ISO}
                    title={p ? `${f.name} · ${tabla.dias[i].fecha}` : ""}
                  ></td>
                {/each}
                <td class="asis-tot">{f.total}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
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
    <div class="acciones">
      <button type="button" class="btn-primario btn-anadir" onclick={exportar}>
        {i18n.t("asistencia.exportar")}
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
    border-right: 1px solid var(--c-borde);
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
    left: 0;
    width: 128px;
    min-width: 128px;
    text-align: left;
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
</style>
