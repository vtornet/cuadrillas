<script lang="ts">
  import { untrack } from "svelte";
  import type { Crew, Worker } from "@cuadrilla/shared";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import EditSheet from "../EditSheet.svelte";

  let {
    registro,
    onclose,
    oneditarworker,
  }: {
    registro: Crew | null;
    onclose: () => void;
    oneditarworker: (worker: Worker) => void;
  } = $props();

  const { reg, ini } = untrack(() => {
    const reg = registro;
    return { reg, ini: { name: reg?.name ?? "" } };
  });

  let name = $state(ini.name);

  const dirty = $derived(name.trim() !== ini.name);
  const valido = $derived(name.trim().length > 0);

  // Se recalcula en cada render: refleja los trabajadores actuales de gestion.
  const trabajadores = $derived(reg ? gestion.trabajadoresDe(reg.id) : []);
  const puedeEliminar = $derived(!!reg && trabajadores.length === 0);

  function construir(): Crew {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      name: name.trim(),
      foremanIds: reg?.foremanIds ?? [sesion.userId],
      updatedAt: Date.now(),
      deleted: 0,
    };
  }
</script>

<EditSheet
  titulo={reg
    ? i18n.t("gestion.editar_cuadrilla")
    : i18n.t("gestion.nueva_cuadrilla")}
  {dirty}
  {valido}
  {puedeEliminar}
  onguardar={() => gestion.guardar("crew", construir())}
  oneliminar={puedeEliminar && reg ? () => gestion.eliminar("crew", reg) : undefined}
  {onclose}
>
  <label class="campo">
    <span>{i18n.t("gestion.cuadrilla_nombre")}</span>
    <input type="text" bind:value={name} autocomplete="off" />
  </label>

  {#if reg}
    <h3>{i18n.t("gestion.cuadrilla_trabajadores", { n: trabajadores.length })}</h3>
    {#if trabajadores.length === 0}
      <p class="registro-vacio">{i18n.t("gestion.cuadrilla_sin_trabajadores")}</p>
    {:else}
      <ul class="crew-workers">
        {#each trabajadores as w (w.id)}
          <li>
            <button
              type="button"
              class="crew-worker-btn"
              onclick={() => oneditarworker(w)}
            >
              <span>{w.name}</span>
              <span class="chevron" aria-hidden="true">&rsaquo;</span>
            </button>
          </li>
        {/each}
      </ul>
      <p class="aviso-tarifa">{i18n.t("gestion.cuadrilla_no_eliminar")}</p>
    {/if}
  {/if}
</EditSheet>
