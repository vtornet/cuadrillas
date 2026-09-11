<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";

  let {
    maxHoras,
    onaplicar,
  }: {
    /** Duración de la jornada (o lo transcurrido si sigue abierta): tope de horas. */
    maxHoras: number;
    onaplicar: (horas: number) => void;
  } = $props();

  let texto = $state("");

  const valor = $derived.by(() => {
    const t = texto.replace(",", ".").trim();
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const superaTope = $derived(valor != null && valor > maxHoras + 0.01);

  function aplicar(): void {
    if (valor == null || superaTope) return;
    onaplicar(valor);
  }
</script>

<div class="horas-todos">
  <div class="horas-todos-fila">
    <input
      type="text"
      inputmode="decimal"
      bind:value={texto}
      placeholder={i18n.t("horas.aplicar_ph")}
      aria-label={i18n.t("horas.aplicar_todos")}
      class:invalido={superaTope}
    />
    <button
      type="button"
      class="btn-secundario"
      disabled={valor == null || superaTope}
      onclick={aplicar}
    >
      {i18n.t("horas.aplicar_todos")}
    </button>
  </div>
  {#if superaTope}
    <p class="login-error">{i18n.t("horas.max_error", { max: maxHoras })}</p>
  {/if}
</div>

<style>
  .horas-todos-fila {
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
  .horas-todos input.invalido {
    border-color: var(--c-peligro);
  }
  .horas-todos button {
    flex: 0 0 auto;
  }
</style>
