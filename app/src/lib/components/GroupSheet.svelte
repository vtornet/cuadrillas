<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import type { Entry, GrupoDeJornada, Worker } from "@cuadrilla/shared";
  import { i18n } from "../i18n/i18n.svelte";

  let {
    group,
    workers,
    entries,
    onmembers,
    onanular,
    onclose,
  }: {
    group: GrupoDeJornada;
    /** Trabajadores de hoy, para el listado de miembros elegibles. */
    workers: Worker[];
    entries: Entry[];
    onmembers: (memberIds: string[]) => Promise<void>;
    onanular: (entryId: string) => Promise<void>;
    onclose: () => void;
  } = $props();

  const inicial = untrack(() => [...group.memberIds].sort());
  let miembros = $state(new Set(inicial));
  let base = $state(inicial);

  const dirty = $derived.by(() => {
    const actual = [...miembros].sort();
    return (
      actual.length !== base.length ||
      actual.some((id, i) => id !== base[i])
    );
  });
  const valido = $derived(miembros.size > 0);

  let guardando = $state(false);
  let guardadoOk = $state(false);
  let confirmandoCierre = $state(false);
  let entryAAnular = $state<string | null>(null);

  function toggle(id: string): void {
    const s = new Set(miembros);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    miembros = s;
  }

  async function guardar(): Promise<void> {
    if (!dirty || !valido || guardando) return;
    guardando = true;
    try {
      await onmembers([...miembros]);
      base = [...miembros].sort();
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
  aria-label={i18n.t("grupo.ficha")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{group.name}</h2>
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
      <h3>{i18n.t("grupo.miembros_hoy")}</h3>
      <ul class="asistencia">
        {#each workers as w (w.id)}
          <li>
            <label>
              <input
                type="checkbox"
                checked={miembros.has(w.id)}
                onchange={() => toggle(w.id)}
              />
              <span>{w.name}</span>
            </label>
          </li>
        {/each}
      </ul>

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
