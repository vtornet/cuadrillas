<script lang="ts">
  import { IDIOMAS } from "@cuadrilla/shared";
  import { i18n, NOMBRE_IDIOMA, type Locale } from "../i18n/i18n.svelte";

  let { compacto = false }: { compacto?: boolean } = $props();

  function cambiar(e: Event): void {
    void i18n.cambiar((e.currentTarget as HTMLSelectElement).value as Locale);
  }
</script>

<label class="campo" class:selidioma-compacto={compacto}>
  {#if !compacto}<span>{i18n.t("cuenta.idioma")}</span>{/if}
  <select
    value={i18n.locale}
    onchange={cambiar}
    aria-label={i18n.t("cuenta.idioma")}
  >
    {#each IDIOMAS as id (id)}
      <option value={id}>{NOMBRE_IDIOMA[id]}</option>
    {/each}
  </select>
</label>

<style>
  .selidioma-compacto {
    margin-top: 14px;
  }
  .selidioma-compacto select {
    text-align: center;
  }
</style>
