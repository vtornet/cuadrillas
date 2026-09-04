<script lang="ts">
  import type { Snippet } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";

  let {
    titulo,
    dirty,
    valido,
    puedeEliminar = false,
    onguardar,
    oneliminar,
    onclose,
    children,
  }: {
    titulo: string;
    dirty: boolean;
    valido: boolean;
    puedeEliminar?: boolean;
    onguardar: () => Promise<void> | void;
    oneliminar?: () => Promise<void> | void;
    onclose: () => void;
    children: Snippet;
  } = $props();

  let guardando = $state(false);
  let eliminando = $state(false);
  let confirmandoCierre = $state(false);
  let confirmandoBorrado = $state(false);

  async function guardar(): Promise<void> {
    if (!dirty || !valido || guardando) return;
    guardando = true;
    try {
      await onguardar();
      onclose();
    } catch (e) {
      console.error("[edit] no se pudo guardar", e);
    } finally {
      guardando = false;
    }
  }

  async function eliminar(): Promise<void> {
    if (!oneliminar || eliminando) return;
    eliminando = true;
    try {
      await oneliminar();
      onclose();
    } catch (e) {
      console.error("[edit] no se pudo eliminar", e);
    } finally {
      eliminando = false;
    }
  }

  function intentarCerrar(): void {
    if (dirty) {
      confirmandoCierre = true;
      return;
    }
    onclose();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") intentarCerrar();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" role="dialog" aria-modal="true" aria-label={titulo}>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{titulo}</h2>
      <button
        type="button"
        class="aspa"
        onclick={intentarCerrar}
        aria-label={i18n.t("worker.cerrar")}
      >
        &times;
      </button>
    </div>

    <div class="hoja-cuerpo">
      {@render children()}

      {#if puedeEliminar && oneliminar}
        <div class="eliminar-zona">
          {#if confirmandoBorrado}
            <span>{i18n.t("gestion.eliminar_confirmar")}</span>
            <div>
              <button
                type="button"
                class="btn-secundario"
                onclick={() => (confirmandoBorrado = false)}
              >
                {i18n.t("pad.cancelar")}
              </button>
              <button
                type="button"
                class="btn-deshacer"
                disabled={eliminando}
                onclick={eliminar}
              >
                {i18n.t("gestion.eliminar")}
              </button>
            </div>
          {:else}
            <button
              type="button"
              class="btn-deshacer"
              onclick={() => (confirmandoBorrado = true)}
            >
              {i18n.t("gestion.eliminar")}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if confirmandoCierre}
      <div class="hoja-pie confirm">
        <span>{i18n.t("worker.cambios_sin_guardar")}</span>
        <div>
          <button
            type="button"
            class="btn-secundario"
            onclick={() => (confirmandoCierre = false)}
          >
            {i18n.t("worker.seguir_editando")}
          </button>
          <button type="button" class="btn-deshacer" onclick={onclose}>
            {i18n.t("worker.cerrar_sin_guardar")}
          </button>
        </div>
      </div>
    {:else}
      <div class="hoja-pie">
        <button
          type="button"
          class="btn-primario"
          disabled={!dirty || !valido || guardando}
          onclick={guardar}
        >
          {i18n.t("worker.guardar")}
        </button>
      </div>
    {/if}
  </div>
</div>
