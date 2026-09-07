<script lang="ts">
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import {
    parsearArchivoWorkers,
    type ResultadoImport,
  } from "../../import/workers";

  let { onclose, onhecho }: { onclose: () => void; onhecho: (n: number) => void } =
    $props();

  let fase = $state<"elegir" | "leyendo" | "revision">("elegir");
  let resultado = $state<ResultadoImport | null>(null);
  let error = $state<string | null>(null);
  let importando = $state(false);
  let inputArchivo = $state<HTMLInputElement | null>(null);

  const sinCuadrilla = $derived(gestion.crews.length === 0);
  const validos = $derived(resultado?.validos ?? []);
  const errores = $derived(resultado?.errores ?? []);

  async function onArchivo(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    fase = "leyendo";
    error = null;
    try {
      resultado = await parsearArchivoWorkers(file, {
        crews: gestion.crews,
        existentes: gestion.workers,
        organizationId: sesion.organizationId,
      });
      fase = "revision";
    } catch (err) {
      console.error("[import] no se pudo leer el archivo", err);
      error = i18n.t("gestion.import_error_lectura");
      fase = "elegir";
    }
  }

  async function importar(): Promise<void> {
    if (importando || validos.length === 0) return;
    importando = true;
    try {
      await gestion.importarWorkers(validos);
      onhecho(validos.length);
      onclose();
    } catch (err) {
      console.error("[import] no se pudieron guardar", err);
      error = i18n.t("gestion.import_error_lectura");
    } finally {
      importando = false;
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={i18n.t("gestion.import_titulo")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("gestion.import_titulo")}</h2>
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
      {#if sinCuadrilla}
        <p class="aviso">{i18n.t("gestion.import_sin_cuadrilla")}</p>
      {:else}
        <p>{i18n.t("gestion.import_ayuda")}</p>

        <input
          bind:this={inputArchivo}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onchange={onArchivo}
          hidden
        />
        {#if fase !== "revision"}
          <button
            type="button"
            class="btn-primario btn-ancho"
            disabled={fase === "leyendo"}
            onclick={() => inputArchivo?.click()}
          >
            {fase === "leyendo"
              ? i18n.t("gestion.import_leyendo")
              : i18n.t("gestion.import_elegir")}
          </button>
        {/if}

        {#if error}
          <p class="aviso">{error}</p>
        {/if}

        {#if fase === "revision" && resultado}
          {#if validos.length > 0}
            <p class="import-ok">
              {i18n.t("gestion.import_listos", { n: validos.length })}
            </p>
          {:else}
            <p class="aviso">{i18n.t("gestion.import_nada")}</p>
          {/if}

          {#if errores.length > 0}
            <p class="import-err-tit">
              {i18n.t("gestion.import_con_error", { n: errores.length })}
            </p>
            <ul class="import-errores">
              {#each errores as e (e.fila)}
                <li>
                  {i18n.t("gestion.import_fila_error", {
                    fila: e.fila,
                    motivo: e.motivo ?? "",
                  })}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      {/if}
    </div>

    <div class="hoja-pie">
      {#if fase === "revision" && validos.length > 0}
        <button
          type="button"
          class="btn-primario"
          disabled={importando}
          onclick={importar}
        >
          {i18n.t("gestion.import_accion", { n: validos.length })}
        </button>
      {:else}
        <button type="button" class="btn-secundario" onclick={onclose}>
          {i18n.t("worker.cerrar")}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .import-ok {
    font-weight: 600;
  }
  .import-err-tit {
    margin-top: 1rem;
    font-weight: 600;
  }
  .import-errores {
    margin: 0.25rem 0 0;
    padding-left: 1.2rem;
    max-height: 40vh;
    overflow-y: auto;
    font-size: 0.9rem;
  }
  .import-errores li {
    margin: 0.15rem 0;
  }
</style>
