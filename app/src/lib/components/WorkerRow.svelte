<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";
  import NumberPad from "./NumberPad.svelte";

  /**
   * Tarjeta de registro (+1/+5/pad). Sirve igual para un trabajador o para un
   * grupo: solo necesita un nombre y un subtitulo (alias, o "N miembros").
   */
  let {
    item,
    conteo,
    onsumar,
    onabrir,
  }: {
    item: { name: string; alias: string };
    conteo: number;
    onsumar: (n: number) => void;
    onabrir: () => void;
  } = $props();

  let padAbierto = $state(false);
</script>

<div class="fila">
  <button type="button" class="ident" onclick={onabrir}>
    <span class="nombre">
      {item.name}<span class="chevron" aria-hidden="true">&rsaquo;</span>
    </span>
    <span class="alias">{item.alias}</span>
  </button>

  <span class="conteo" aria-live="polite" aria-label={`${item.name}: ${conteo}`}>
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
    titulo={item.name}
    onconfirm={(n) => {
      onsumar(n);
      padAbierto = false;
    }}
    onclose={() => (padAbierto = false)}
  />
{/if}
