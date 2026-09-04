<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";

  let {
    titulo,
    onconfirm,
    onclose,
  }: {
    titulo: string;
    onconfirm: (n: number) => void;
    onclose: () => void;
  } = $props();

  let texto = $state("");
  let negativo = $state(false);

  const valor = $derived(
    (negativo ? -1 : 1) * (Number.parseInt(texto || "0", 10) || 0),
  );

  function pulsa(d: string): void {
    texto = (texto + d).slice(0, 5);
  }

  function borra(): void {
    texto = texto.slice(0, -1);
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={i18n.t("pad.cantidad")}>
  <div class="hoja">
    <p class="pad-titulo">{titulo}</p>
    <output class="pad-valor" class:neg={negativo && valor !== 0}>{valor}</output>

    <div class="pad-grid">
      {#each ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as d (d)}
        <button type="button" onclick={() => pulsa(d)}>{d}</button>
      {/each}
      <button type="button" onclick={() => (negativo = !negativo)}>&plusmn;</button>
      <button type="button" onclick={() => pulsa("0")}>0</button>
      <button type="button" onclick={borra} aria-label="Borrar">&#9003;</button>
    </div>

    <div class="pad-acciones">
      <button type="button" class="btn-secundario" onclick={onclose}>
        {i18n.t("pad.cancelar")}
      </button>
      <button
        type="button"
        class="btn-primario"
        disabled={valor === 0}
        onclick={() => onconfirm(valor)}
      >
        {i18n.t("pad.anadir")}
      </button>
    </div>
  </div>
</div>
