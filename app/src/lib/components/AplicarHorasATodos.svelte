<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";

  let { onaplicar }: { onaplicar: (horas: number) => void } = $props();

  let texto = $state("");

  const valor = $derived.by(() => {
    const t = texto.replace(",", ".").trim();
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  function aplicar(): void {
    if (valor == null) return;
    onaplicar(valor);
  }
</script>

<div class="horas-todos">
  <input
    type="text"
    inputmode="decimal"
    bind:value={texto}
    placeholder={i18n.t("horas.aplicar_ph")}
    aria-label={i18n.t("horas.aplicar_todos")}
  />
  <button type="button" class="btn-secundario" disabled={valor == null} onclick={aplicar}>
    {i18n.t("horas.aplicar_todos")}
  </button>
</div>

<style>
  .horas-todos {
    display: flex;
    gap: 8px;
  }
  .horas-todos input {
    flex: 1;
    min-width: 0;
    padding: 10px;
    font: inherit;
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    background: var(--c-superficie);
  }
  .horas-todos button {
    flex: 0 0 auto;
  }
</style>
