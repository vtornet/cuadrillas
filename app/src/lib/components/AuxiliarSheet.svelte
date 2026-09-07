<script lang="ts">
  import { untrack } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";
  import type { AuxiliarConTrabajo } from "../stores/jornada.svelte";

  let {
    aux,
    onsave,
    onclose,
    soloLectura = false,
  }: {
    aux: AuxiliarConTrabajo;
    onsave: (datos: { tarea: string; horas: number | null }) => Promise<void> | void;
    onclose: () => void;
    soloLectura?: boolean;
  } = $props();

  const ini = untrack(() => ({
    tarea: aux.tarea,
    horas: aux.horas != null ? String(aux.horas).replace(".", ",") : "",
  }));
  let tarea = $state(ini.tarea);
  let horas = $state(ini.horas);
  let guardando = $state(false);

  const horasNum = $derived.by(() => {
    const t = horas.replace(",", ".").trim();
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  });
  const horasValidas = $derived(!Number.isNaN(horasNum));
  const dirty = $derived(
    tarea.trim() !== aux.tarea || (horasNum ?? null) !== (aux.horas ?? null),
  );

  async function guardar(): Promise<void> {
    if (guardando || !horasValidas) return;
    guardando = true;
    try {
      await onsave({ tarea, horas: horasNum as number | null });
      onclose();
    } catch (e) {
      console.error("[auxiliar] guardar", e);
    } finally {
      guardando = false;
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" role="dialog" aria-modal="true" aria-label={aux.worker.name}>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{aux.worker.name}</h2>
      <button
        type="button"
        class="aspa"
        onclick={onclose}
        aria-label={i18n.t("worker.cerrar")}
      >
        &times;
      </button>
    </div>

    <div class="hoja-cuerpo">
      <p class="jc-sub">{i18n.t("auxiliar.subtitulo")}</p>

      <label class="campo">
        <span>{i18n.t("auxiliar.tarea")}</span>
        <input
          type="text"
          bind:value={tarea}
          autocomplete="off"
          disabled={soloLectura}
          placeholder={i18n.t("auxiliar.tarea_ph")}
        />
      </label>
      <label class="campo">
        <span>{i18n.t("auxiliar.horas")}</span>
        <input
          type="text"
          inputmode="decimal"
          bind:value={horas}
          disabled={soloLectura}
          placeholder={i18n.t("auxiliar.horas_ph")}
        />
      </label>
      {#if !horasValidas}
        <p class="login-error">{i18n.t("auxiliar.horas_error")}</p>
      {/if}
    </div>

    <div class="hoja-pie">
      {#if soloLectura}
        <button type="button" class="btn-primario" onclick={onclose}>
          {i18n.t("worker.cerrar")}
        </button>
      {:else}
        <button
          type="button"
          class="btn-primario"
          disabled={!dirty || !horasValidas || guardando}
          onclick={guardar}
        >
          {i18n.t("worker.guardar")}
        </button>
      {/if}
    </div>
  </div>
</div>
