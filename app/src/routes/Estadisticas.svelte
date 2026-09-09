<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew, Entry, Shift, Worker } from "@cuadrilla/shared";
  import {
    calcularEstadisticas,
    fechaES,
    type Estadisticas,
  } from "@cuadrilla/shared/domain";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { jornada } from "../lib/stores/jornada.svelte";
  import { crewsDelForeman } from "../lib/db/repositories/crews";
  import { shiftsDeCuadrillas } from "../lib/db/repositories/shifts";
  import { entriesDeShifts } from "../lib/db/repositories/entries";
  import { workersDeCuadrillas } from "../lib/db/repositories/workers";
  import { obtenerProducto, obtenerUnidad } from "../lib/db/repositories/products";
  import AppBar from "../lib/components/AppBar.svelte";
  import BarrasRanking from "../lib/components/stats/BarrasRanking.svelte";
  import GraficoEvolucion from "../lib/components/stats/GraficoEvolucion.svelte";

  type Modo = "jornada" | "rango";

  function isoHoy(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function isoMenos(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10);
  }
  function minutosAhora(): number {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  let listo = $state(false);
  let modo = $state<Modo>("jornada");

  let crews = $state<Crew[]>([]);
  let shifts = $state<Shift[]>([]);

  let shiftId = $state("");
  let crewId = $state("");
  let desde = $state(isoMenos(6));
  let hasta = $state(isoHoy());

  let stats = $state<Estadisticas | null>(null);
  let unidadNombre = $state("");
  let sinDatos = $state(false);

  onMount(async () => {
    crews = await crewsDelForeman(sesion.userId);
    const crewIds = crews.map((c) => c.id);
    shifts = crewIds.length > 0 ? await shiftsDeCuadrillas(crewIds) : [];

    crewId = crews[0]?.id ?? "";
    shiftId = jornada.shift?.id ?? shifts[0]?.id ?? "";
    listo = true;
  });

  const shiftsRango = $derived(
    shifts.filter(
      (s) => s.crewId === crewId && s.fecha >= desde && s.fecha <= hasta,
    ),
  );

  $effect(() => {
    if (!listo) return;
    // dependencias
    modo;
    shiftId;
    crewId;
    desde;
    hasta;
    void recalcular();
  });

  async function recalcular(): Promise<void> {
    let usados: Shift[];
    if (modo === "jornada") {
      const s = shifts.find((x) => x.id === shiftId);
      usados = s ? [s] : [];
    } else {
      usados = shiftsRango;
    }

    if (usados.length === 0) {
      stats = null;
      sinDatos = true;
      unidadNombre = "";
      return;
    }

    const crewIds = [...new Set(usados.map((s) => s.crewId))];
    const [workers, entries] = await Promise.all([
      workersDeCuadrillas(crewIds),
      entriesDeShifts(usados.map((s) => s.id)),
    ]);

    stats = calcularEstadisticas(usados, workers as Worker[], entries as Entry[], {
      ahoraMin: minutosAhora(),
    });
    sinDatos = stats.totalUnidades === 0 && stats.totalHoras === 0;

    // etiqueta de unidad si todas las jornadas comparten unidad
    const unidades = new Set(usados.map((s) => s.unitTypeId));
    if (unidades.size === 1) {
      const u = await obtenerUnidad(usados[0].unitTypeId);
      unidadNombre = u?.name ?? "";
    } else {
      unidadNombre = "";
    }
  }

  function etiquetaShift(s: Shift): string {
    return `${fechaES(s.fecha)}${s.estado === "open" ? " · " + i18n.t("stats.abierta") : ""}`;
  }

  const num = (n: number | null): string =>
    n === null ? "—" : n.toLocaleString(i18n.locale, { maximumFractionDigits: 2 });
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("stats.titulo")} />
    <div class="tabs">
      <button
        type="button"
        class="tab"
        class:activo={modo === "jornada"}
        onclick={() => (modo = "jornada")}
      >
        {i18n.t("stats.por_jornada")}
      </button>
      <button
        type="button"
        class="tab"
        class:activo={modo === "rango"}
        onclick={() => (modo = "rango")}
      >
        {i18n.t("stats.por_rango")}
      </button>
    </div>
  </header>

  <div class="pantalla-cuerpo">
    {#if !listo}
      <p class="vacio-lista">{i18n.t("app.cargando")}</p>
    {:else if shifts.length === 0}
      <p class="vacio-lista">{i18n.t("stats.sin_jornadas")}</p>
    {:else}
      {#if modo === "jornada"}
        <label class="campo">
          <span>{i18n.t("stats.jornada")}</span>
          <select bind:value={shiftId}>
            {#each shifts as s (s.id)}
              <option value={s.id}>{etiquetaShift(s)}</option>
            {/each}
          </select>
        </label>
      {:else}
        {#if crews.length > 1}
          <label class="campo">
            <span>{i18n.t("jornada.cuadrilla")}</span>
            <select bind:value={crewId}>
              {#each crews as c (c.id)}
                <option value={c.id}>{c.name}</option>
              {/each}
            </select>
          </label>
        {/if}
        <div class="campo-fila">
          <label class="campo">
            <span>{i18n.t("stats.desde")}</span>
            <input type="date" bind:value={desde} max={hasta} />
          </label>
          <label class="campo">
            <span>{i18n.t("stats.hasta")}</span>
            <input type="date" bind:value={hasta} min={desde} />
          </label>
        </div>
      {/if}

      {#if !stats || sinDatos}
        <p class="vacio-lista">{i18n.t("stats.sin_datos")}</p>
      {:else}
        <div class="stat-cards">
          <div class="stat-card">
            <span class="sc-valor">{num(stats.totalUnidades)}</span>
            <span class="sc-label">
              {unidadNombre || i18n.t("stats.unidades")}
            </span>
          </div>
          <div class="stat-card">
            <span class="sc-valor">{num(stats.mediaUnidades)}</span>
            <span class="sc-label">{i18n.t("stats.media_trabajador")}</span>
          </div>
          <div class="stat-card">
            <span class="sc-valor">{num(stats.mediaUnidadesPorHora)}</span>
            <span class="sc-label">{i18n.t("stats.unidades_hora")}</span>
          </div>
          <div class="stat-card">
            <span class="sc-valor">{num(stats.totalHoras)}</span>
            <span class="sc-label">{i18n.t("stats.horas")}</span>
          </div>
        </div>

        {#if stats.evolucion.length > 1}
          <section class="bloque">
            <h2>{i18n.t("stats.evolucion")}</h2>
            <GraficoEvolucion puntos={stats.evolucion} />
          </section>
        {/if}

        <section class="bloque">
          <h2>{i18n.t("stats.ranking")}</h2>
          <BarrasRanking filas={stats.filas} />
        </section>
      {/if}
    {/if}
  </div>
</div>
