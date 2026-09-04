<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import type { Entry, Idioma, Worker } from "@cuadrilla/shared";
  import { IDIOMAS } from "@cuadrilla/shared";
  import { i18n } from "../i18n/i18n.svelte";
  import type { CambiosWorker } from "../stores/jornada.svelte";

  let {
    worker,
    entries,
    onsave,
    onanular,
    onclose,
  }: {
    worker: Worker;
    entries: Entry[];
    onsave: (cambios: CambiosWorker) => Promise<void>;
    onanular: (entryId: string) => Promise<void>;
    onclose: () => void;
  } = $props();

  const IDIOMA_LABEL: Record<Idioma, string> = {
    es: "Español",
    ro: "Română",
    ar: "العربية",
    fr: "Français",
    en: "English",
  };

  // La ficha se re-monta por trabajador ({#key} en Registro), asi que tomar el
  // valor inicial del prop es intencionado.
  const inicial = untrack(() => ({
    name: worker.name,
    alias: worker.alias,
    language: worker.language,
    activo: worker.activo === 1,
  }));

  // Formulario.
  let name = $state(inicial.name);
  let alias = $state(inicial.alias);
  let language = $state<Idioma>(inicial.language);
  let activo = $state(inicial.activo);

  // Instantanea para detectar cambios sin guardar.
  let base = $state({ ...inicial });

  const dirty = $derived(
    name.trim() !== base.name ||
      alias.trim() !== base.alias ||
      language !== base.language ||
      activo !== base.activo,
  );
  const valido = $derived(name.trim().length > 0 && alias.trim().length > 0);

  let guardando = $state(false);
  let guardadoOk = $state(false);
  let confirmandoCierre = $state(false);
  let entryAAnular = $state<string | null>(null);

  async function guardar(): Promise<void> {
    if (!dirty || !valido || guardando) return;
    guardando = true;
    try {
      const cambios: CambiosWorker = {
        name: name.trim(),
        alias: alias.trim(),
        language,
        activo: activo ? 1 : 0,
      };
      await onsave(cambios);
      base = {
        name: cambios.name,
        alias: cambios.alias,
        language,
        activo,
      };
      guardadoOk = true;
      setTimeout(() => (guardadoOk = false), 2000);
    } finally {
      guardando = false;
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

  onMount(() => window.addEventListener("keydown", onKey));
  onDestroy(() => window.removeEventListener("keydown", onKey));

  function hora(ts: number): string {
    return new Date(ts).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function signo(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
  }
</script>

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={i18n.t("worker.editar")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("worker.editar")}</h2>
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
      <label class="campo">
        <span>{i18n.t("worker.nombre")}</span>
        <input type="text" bind:value={name} autocomplete="off" />
      </label>

      <label class="campo">
        <span>{i18n.t("worker.alias")}</span>
        <input type="text" bind:value={alias} autocomplete="off" />
      </label>

      <label class="campo">
        <span>{i18n.t("worker.idioma")}</span>
        <select bind:value={language}>
          {#each IDIOMAS as id (id)}
            <option value={id}>{IDIOMA_LABEL[id]}</option>
          {/each}
        </select>
      </label>

      <label class="campo campo-check">
        <input type="checkbox" bind:checked={activo} />
        <span>{i18n.t("worker.activo")}</span>
      </label>

      <h3>{i18n.t("worker.registro_titulo")}</h3>
      {#if entries.length === 0}
        <p class="registro-vacio">{i18n.t("worker.registro_vacio")}</p>
      {:else}
        <ul class="registro">
          {#each entries as e (e.id)}
            <li class:anulada={e.deleted === 1}>
              <span class="r-hora">{hora(e.timestamp)}</span>
              <span class="r-cant">{signo(e.cantidad)}</span>
              {#if e.deleted === 1}
                <span class="r-etq">{i18n.t("worker.anulada")}</span>
              {:else if entryAAnular === e.id}
                <span class="r-confirm">
                  <button
                    type="button"
                    class="mini"
                    onclick={() => (entryAAnular = null)}
                  >
                    {i18n.t("pad.cancelar")}
                  </button>
                  <button
                    type="button"
                    class="mini peligro"
                    onclick={() => {
                      const id = e.id;
                      entryAAnular = null;
                      void onanular(id);
                    }}
                  >
                    {i18n.t("worker.anular")}
                  </button>
                </span>
              {:else}
                <button
                  type="button"
                  class="r-anular"
                  onclick={() => (entryAAnular = e.id)}
                >
                  {i18n.t("worker.anular")}
                </button>
              {/if}
            </li>
          {/each}
        </ul>
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
        {#if guardadoOk}
          <span class="ok">{i18n.t("worker.guardado")}</span>
        {/if}
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
