<script lang="ts">
  import { untrack } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";

  let {
    valor,
    soloLectura = false,
    onguardar,
  }: {
    valor: string;
    soloLectura?: boolean;
    onguardar?: (texto: string) => void;
  } = $props();

  // Copia local editable; se resincroniza si el parte se recarga desde fuera.
  let texto = $state(untrack(() => valor));
  $effect(() => {
    texto = valor;
  });

  function alSalir(): void {
    if (!soloLectura && texto.trim() !== valor.trim()) onguardar?.(texto);
  }
</script>

{#if soloLectura}
  {#if valor.trim()}
    <section class="obs">
      <h3>{i18n.t("compartir.observaciones")}</h3>
      <p class="obs-texto">{valor}</p>
    </section>
  {/if}
{:else}
  <section class="obs">
    <label class="campo">
      <span>{i18n.t("compartir.observaciones")}</span>
      <textarea
        bind:value={texto}
        rows="3"
        placeholder={i18n.t("registro.observaciones_ph")}
        onblur={alSalir}
      ></textarea>
    </label>
  </section>
{/if}

<style>
  .obs {
    margin: 4px 0 8px;
  }
  .obs h3 {
    margin: 0 0 4px;
  }
  .obs-texto {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .obs textarea {
    width: 100%;
    resize: vertical;
    min-height: calc(var(--tap) * 1.4);
    font: inherit;
    padding: 10px;
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    background: var(--c-superficie);
    box-sizing: border-box;
  }
</style>
