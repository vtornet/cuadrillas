<script lang="ts">
  import type { Worker } from "@cuadrilla/shared";
  import { estadoAlta, faltanDatosAlta } from "@cuadrilla/shared/domain";
  import { api } from "./api";

  let {
    worker,
    onguardado,
  }: {
    worker: Worker & { cuadrilla: string };
    onguardado?: (w: Worker & { cuadrilla: string }) => void;
  } = $props();

  const l = $derived(worker.laboral ?? {});

  let dni = $state("");
  let numAfiliacionSS = $state("");
  let iban = $state("");
  let fechaAlta = $state("");
  let fechaBaja = $state("");
  let tipoContrato = $state("");
  let categoria = $state("");

  // Rellena el formulario cada vez que cambia el trabajador.
  $effect(() => {
    const x = worker.laboral ?? {};
    dni = x.dni ?? "";
    numAfiliacionSS = x.numAfiliacionSS ?? "";
    iban = x.iban ?? "";
    fechaAlta = x.fechaAlta ?? "";
    fechaBaja = x.fechaBaja ?? "";
    tipoContrato = x.tipoContrato ?? "";
    categoria = x.categoria ?? "";
  });

  let guardando = $state(false);
  let error = $state<string | null>(null);
  let ok = $state(false);

  async function guardar(): Promise<void> {
    guardando = true;
    error = null;
    ok = false;
    try {
      const actualizado = await api<Worker>(
        `/trabajadores/${worker.id}/laboral`,
        {
          metodo: "PUT",
          body: {
            dni,
            numAfiliacionSS,
            iban,
            fechaAlta,
            fechaBaja,
            tipoContrato,
            categoria,
          },
        },
      );
      ok = true;
      onguardado?.({ ...actualizado, cuadrilla: worker.cuadrilla });
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al guardar";
    } finally {
      guardando = false;
    }
  }
</script>

<div class="fl">
  <p class="estado">
    Alta:
    {#if estadoAlta(worker) === "completa"}
      <span class="badge ok">completa</span>
    {:else}
      <span class="badge pend">pendiente</span>
      <span class="faltan">faltan: {faltanDatosAlta(worker).join(", ")}</span>
    {/if}
  </p>

  <div class="rej">
    <label>DNI / NIE <input type="text" bind:value={dni} /></label>
    <label>Nº afiliación SS <input type="text" bind:value={numAfiliacionSS} /></label>
    <label>IBAN <input type="text" bind:value={iban} /></label>
    <label>Fecha de alta <input type="date" bind:value={fechaAlta} /></label>
    <label>Fecha de baja <input type="date" bind:value={fechaBaja} /></label>
    <label>Tipo de contrato <input type="text" bind:value={tipoContrato} /></label>
    <label>Categoría <input type="text" bind:value={categoria} /></label>
  </div>

  {#if error}<p class="aviso">{error}</p>{/if}
  {#if ok}<p class="ok-msg">Guardado.</p>{/if}

  <button type="button" class="primario" disabled={guardando} onclick={guardar}>
    {guardando ? "Guardando…" : "Guardar datos laborales"}
  </button>
</div>

<style>
  .fl {
    max-width: 560px;
  }
  .estado {
    margin: 0 0 12px;
  }
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
  }
  .badge.ok {
    background: #dcfae6;
    color: #067647;
  }
  .badge.pend {
    background: #fef0c7;
    color: #b54708;
  }
  .faltan {
    color: var(--suave);
    font-size: 13px;
    margin-left: 6px;
  }
  .rej {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  .rej label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 13px;
    color: var(--suave);
  }
  .rej input {
    font-size: 14px;
  }
  .ok-msg {
    color: var(--verde);
  }
  @media (max-width: 560px) {
    .rej {
      grid-template-columns: 1fr;
    }
  }
</style>
