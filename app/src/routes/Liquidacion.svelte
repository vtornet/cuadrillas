<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew } from "@cuadrilla/shared";
  import {
    calcularLiquidacion,
    type Liquidacion,
  } from "@cuadrilla/shared/domain";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { centimosAEuros } from "../lib/money";
  import { crewsDelForeman } from "../lib/db/repositories/crews";
  import { shiftsDeCuadrillas } from "../lib/db/repositories/shifts";
  import { entriesDeShifts } from "../lib/db/repositories/entries";
  import { workersDeCuadrillas } from "../lib/db/repositories/workers";
  import { todasLasTarifas } from "../lib/db/repositories/rates";
  import {
    todasLasUnidades,
    todosLosProductos,
  } from "../lib/db/repositories/products";
  import { liquidacionACsv, type ResolutorNombres } from "../lib/export/csv";
  import { liquidacionAXlsx } from "../lib/export/xlsx";
  import { compartirArchivo, slug } from "../lib/export/compartir";
  import AppBar from "../lib/components/AppBar.svelte";

  function isoHoy(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function inicioMes(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  let listo = $state(false);
  let crews = $state<Crew[]>([]);
  let crewId = $state("");
  let desde = $state(inicioMes());
  let hasta = $state(isoHoy());

  let liq = $state<Liquidacion | null>(null);
  let generando = $state(false);
  let mensaje = $state("");

  const nombreProducto = new Map<string, string>();
  const nombreUnidad = new Map<string, string>();

  const nombres: ResolutorNombres = {
    producto: (id) => nombreProducto.get(id) ?? "?",
    unidad: (id) => nombreUnidad.get(id) ?? "?",
  };

  onMount(async () => {
    crews = await crewsDelForeman(sesion.userId);
    crewId = crews[0]?.id ?? "";
    for (const p of await todosLosProductos(sesion.organizationId)) {
      nombreProducto.set(p.id, p.name);
    }
    for (const u of await todasLasUnidades(sesion.organizationId)) {
      nombreUnidad.set(u.id, u.name);
    }
    listo = true;
  });

  $effect(() => {
    if (!listo) return;
    crewId;
    desde;
    hasta;
    void recalcular();
  });

  async function recalcular(): Promise<void> {
    mensaje = "";
    if (!crewId) {
      liq = null;
      return;
    }
    const shifts = (await shiftsDeCuadrillas([crewId])).filter(
      (s) => s.fecha >= desde && s.fecha <= hasta,
    );
    const [workers, entries, rates] = await Promise.all([
      workersDeCuadrillas([crewId]),
      entriesDeShifts(shifts.map((s) => s.id)),
      todasLasTarifas(sesion.organizationId),
    ]);
    liq = calcularLiquidacion(shifts, workers, entries, rates, { desde, hasta });
  }

  function nombreArchivo(ext: string): string {
    const c = crews.find((x) => x.id === crewId)?.name ?? "cuadrilla";
    return `liquidacion_${slug(c)}_${desde}_${hasta}.${ext}`;
  }

  async function exportarCsv(): Promise<void> {
    if (!liq || generando) return;
    generando = true;
    try {
      const blob = new Blob([liquidacionACsv(liq)], {
        type: "text/csv;charset=utf-8",
      });
      const r = await compartirArchivo(blob, nombreArchivo("csv"));
      mensaje = i18n.t(`export.${r}`);
    } finally {
      generando = false;
    }
  }

  async function exportarXlsx(): Promise<void> {
    if (!liq || generando) return;
    generando = true;
    try {
      const blob = await liquidacionAXlsx(liq, nombres);
      const r = await compartirArchivo(blob, nombreArchivo("xlsx"));
      mensaje = i18n.t(`export.${r}`);
    } catch (e) {
      console.error("[export] xlsx", e);
      mensaje = i18n.t("export.error");
    } finally {
      generando = false;
    }
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("liq.titulo")} />
  </header>

  <div class="pantalla-cuerpo">
    {#if !listo}
      <p class="vacio-lista">{i18n.t("app.cargando")}</p>
    {:else if crews.length === 0}
      <p class="vacio-lista">{i18n.t("jornada.sin_cuadrillas")}</p>
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

      {#if !liq || liq.trabajadores.length === 0}
        <p class="vacio-lista">{i18n.t("stats.sin_datos")}</p>
      {:else}
        {#if liq.hayLineasSinTarifa}
          <p class="aviso-tarifa">{i18n.t("liq.aviso_sin_tarifa")}</p>
        {/if}

        <ul class="liq-lista">
          {#each liq.trabajadores as t (t.workerId)}
            <li class="liq-fila">
              <div class="lf-cab">
                <span class="lf-nombre">{t.name}</span>
                <span class="lf-importe">{centimosAEuros(t.totalCentimos)}</span>
              </div>
              {#each t.lineas as l (l.productId + l.unitTypeId)}
                <div class="lf-linea">
                  <span>
                    {nombres.producto(l.productId)} · {nombres.unidad(l.unitTypeId)}
                  </span>
                  <span>
                    {l.unidades}
                    {#if l.sinTarifa}<em class="lf-sin">{i18n.t("liq.sin_tarifa")}</em>{/if}
                  </span>
                </div>
              {/each}
              {#if t.transporteCentimos > 0}
                <div class="lf-linea">
                  <span>
                    {i18n.t("liq.transporte")} ({i18n.t("liq.dias", { n: t.diasTrabajados })})
                  </span>
                  <span>{centimosAEuros(t.transporteCentimos)}</span>
                </div>
              {/if}
            </li>
          {/each}
        </ul>

        <div class="liq-desglose">
          <span>{i18n.t("liq.destajo")}</span>
          <span>{centimosAEuros(liq.destajoCentimos)}</span>
        </div>
        {#if liq.transporteCentimos > 0}
          <div class="liq-desglose">
            <span>{i18n.t("liq.transporte")}</span>
            <span>{centimosAEuros(liq.transporteCentimos)}</span>
          </div>
        {/if}
        <div class="liq-total">
          <span>{i18n.t("liq.total")}</span>
          <strong>{centimosAEuros(liq.totalCentimos)}</strong>
        </div>

        {#if mensaje}<p class="liq-msg">{mensaje}</p>{/if}
      {/if}
    {/if}
  </div>

  {#if liq && liq.trabajadores.length > 0}
    <div class="acciones">
      <button
        type="button"
        class="btn-secundario"
        disabled={generando}
        onclick={exportarCsv}
      >
        {i18n.t("liq.csv")}
      </button>
      <button
        type="button"
        class="btn-primario"
        disabled={generando}
        onclick={exportarXlsx}
      >
        {i18n.t("liq.xlsx")}
      </button>
    </div>
  {/if}
</div>
