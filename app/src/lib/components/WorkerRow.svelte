<script lang="ts">
  import type { Worker } from "@cuadrilla/shared";
  import { i18n } from "../i18n/i18n.svelte";
  import NumberPad from "./NumberPad.svelte";

  let {
    worker,
    conteo,
    onsumar,
    onabrir,
  }: {
    worker: Worker;
    conteo: number;
    onsumar: (n: number) => void;
    onabrir: () => void;
  } = $props();

  let padAbierto = $state(false);
</script>

<div class="fila">
  <button type="button" class="ident" onclick={onabrir}>
    <span class="nombre">
      {worker.name}<span class="chevron" aria-hidden="true">&rsaquo;</span>
    </span>
    <span class="alias">{worker.alias}</span>
  </button>

  <span class="conteo" aria-live="polite" aria-label={`${worker.name}: ${conteo}`}>
    {conteo}
  </span>

  <div class="botones">
    <button type="button" class="mas" onclick={() => onsumar(1)}>+1</button>
    <button type="button" class="mas" onclick={() => onsumar(5)}>+5</button>
    <button
      type="button"
      class="pad"
      onclick={() => (padAbierto = true)}
      aria-label={i18n.t("pad.cantidad")}
    >
      &hellip;
    </button>
  </div>
</div>

{#if padAbierto}
  <NumberPad
    titulo={worker.name}
    onconfirm={(n) => {
      onsumar(n);
      padAbierto = false;
    }}
    onclose={() => (padAbierto = false)}
  />
{/if}
