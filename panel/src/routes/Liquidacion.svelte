<script lang="ts">
  import type { Crew } from "@cuadrilla/shared";
  import type { Liquidacion } from "@cuadrilla/shared/domain";
  import { get } from "../lib/api";
  import { eur } from "../lib/money";

  function primerDiaMes(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
  function hoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  let desde = $state(primerDiaMes());
  let hasta = $state(hoy());
  let crewId = $state("");

  let crews = $state<Crew[]>([]);
  let liq = $state<Liquidacion | null>(null);
  let error = $state<string | null>(null);
  let cargando = $state(false);

  $effect(() => {
    get<Crew[]>("/cuadrillas").then((c) => (crews = c)).catch(() => {});
  });

  async function calcular(): Promise<void> {
    if (!desde || !hasta) return;
    cargando = true;
    error = null;
    try {
      liq = await get<Liquidacion>("/liquidacion", {
        desde,
        hasta,
        crewId: crewId || undefined,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    } finally {
      cargando = false;
    }
  }
</script>

<h1>Liquidación por periodo</h1>
<p style="color:var(--suave)">
  Destajo (unidades × tarifa vigente) + transporte por día trabajado. Se
  recalcula al vuelo desde los partes.
</p>

<div class="filtros">
  <label>Desde <input type="date" bind:value={desde} /></label>
  <label>Hasta <input type="date" bind:value={hasta} /></label>
  <select bind:value={crewId}>
    <option value="">Todas las cuadrillas</option>
    {#each crews as c (c.id)}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
  <button type="button" class="primario" disabled={cargando} onclick={calcular}>
    {cargando ? "Calculando…" : "Calcular"}
  </button>
</div>

{#if error}
  <p class="aviso">{error}</p>
{:else if !liq}
  <p class="vacio">Elige un periodo y pulsa «Calcular».</p>
{:else}
  {#if liq.hayLineasSinTarifa}
    <p class="aviso">
      ⚠ Hay unidades sin tarifa vigente en el periodo: su importe cuenta como 0.
      Revisa las Tarifas.
    </p>
  {/if}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr>
          <th>Trabajador</th>
          <th>Unidades</th>
          <th>Destajo</th>
          <th>Días</th>
          <th>Transporte</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {#each liq.trabajadores as t (t.workerId)}
          <tr>
            <td>{t.name}{t.tieneLineasSinTarifa ? " ⚠" : ""}</td>
            <td>{t.totalUnidades}</td>
            <td>{eur(t.importeCentimos)}</td>
            <td>{t.diasTrabajados}</td>
            <td>{eur(t.transporteCentimos)}</td>
            <td><strong>{eur(t.totalCentimos)}</strong></td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td><strong>TOTAL</strong></td>
          <td><strong>{liq.totalUnidades}</strong></td>
          <td><strong>{eur(liq.destajoCentimos)}</strong></td>
          <td></td>
          <td><strong>{eur(liq.transporteCentimos)}</strong></td>
          <td><strong>{eur(liq.totalCentimos)}</strong></td>
        </tr>
      </tfoot>
    </table>
  </div>
{/if}
