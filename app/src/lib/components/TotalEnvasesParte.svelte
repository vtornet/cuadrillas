<script lang="ts">
  import { untrack } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";

  /**
   * Total de envases del día (modo "por horas") + media por recolector
   * calculada al vuelo. Guarda al perder el foco, igual que ObservacionesParte.
   */
  let {
    total,
    numRecolectores,
    soloLectura = false,
    onguardar,
  }: {
    total: number | null;
    numRecolectores: number;
    soloLectura?: boolean;
    onguardar?: (total: number | null) => void;
  } = $props();

  function aTexto(t: number | null): string {
    return t != null ? String(t).replace(".", ",") : "";
  }

  let texto = $state(untrack(() => aTexto(total)));
  $effect(() => {
    texto = aTexto(total);
  });

  const valor = $derived.by(() => {
    const t = texto.replace(",", ".").trim();
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  });
  const valido = $derived(!Number.isNaN(valor));
  const media = $derived(
    valor != null && !Number.isNaN(valor) && numRecolectores > 0
      ? Math.round((valor / numRecolectores) * 10) / 10
      : null,
  );

  function alSalir(): void {
    if (!soloLectura && valido && valor !== total) onguardar?.(valor);
  }
</script>

{#if soloLectura}
  {#if total != null}
    <section class="envases">
      <h3>{i18n.t("horas.total_envases")}</h3>
      <p class="envases-valor">
        {total}
        {#if media != null}
          <span class="envases-media">
            · {i18n.t("horas.media_por_recolector", { n: media })}
          </span>
        {/if}
      </p>
    </section>
  {/if}
{:else}
  <section class="envases">
    <label class="campo">
      <span>{i18n.t("horas.total_envases")}</span>
      <input
        type="text"
        inputmode="decimal"
        bind:value={texto}
        onblur={alSalir}
        placeholder="0"
        class:invalido={!valido}
      />
    </label>
    {#if !valido}
      <p class="login-error">{i18n.t("horas.total_envases_error")}</p>
    {:else if media != null}
      <p class="envases-media">{i18n.t("horas.media_por_recolector", { n: media })}</p>
    {/if}
  </section>
{/if}

<style>
  .envases {
    margin: 4px 0 8px;
  }
  .envases h3 {
    margin: 0 0 4px;
  }
  .envases-valor {
    margin: 0;
  }
  .envases-media {
    color: var(--c-texto-suave);
    font-size: 14px;
  }
  .envases input.invalido {
    border-color: var(--c-peligro);
  }
</style>
