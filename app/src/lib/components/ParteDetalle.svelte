<script lang="ts">
  import { onMount } from "svelte";
  import type { Entry, Product, Shift, UnitType, Worker } from "@cuadrilla/shared";
  import { sumarConteos } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";
  import { sesion } from "../stores/sesion.svelte";
  import type { CambiosWorker } from "../stores/jornada.svelte";
  import { obtenerShift } from "../db/repositories/shifts";
  import { obtenerProducto, obtenerUnidad } from "../db/repositories/products";
  import { guardarWorker, trabajadoresDeCuadrilla } from "../db/repositories/workers";
  import {
    anularEntry,
    crearEntry,
    entriesDeJornada,
    registrarEntry,
  } from "../db/repositories/entries";
  import AppBar from "./AppBar.svelte";
  import WorkerRow from "./WorkerRow.svelte";
  import WorkerSheet from "./WorkerSheet.svelte";

  let { shiftId, onclose }: { shiftId: string; onclose: () => void } = $props();

  let shift = $state<Shift | null>(null);
  let producto = $state<Product | null>(null);
  let unidad = $state<UnitType | null>(null);
  let workers = $state<Worker[]>([]);
  let entries = $state<Entry[]>([]);
  let cargando = $state(true);

  let modo = $state<"consulta" | "edicion">("consulta");
  let confirmandoEditar = $state(false);
  let workerAbiertoId = $state<string | null>(null);

  const conteos = $derived(sumarConteos(entries));
  const total = $derived(Object.values(conteos).reduce((a, b) => a + b, 0));
  const workerAbierto = $derived(
    workerAbiertoId
      ? (workers.find((w) => w.id === workerAbiertoId) ?? null)
      : null,
  );
  const infoParte = $derived(
    shift && producto && unidad
      ? i18n.t("registro.jornada_info", {
          producto: producto.name,
          unidad: unidad.name,
          fecha: shift.fecha,
        })
      : "",
  );

  onMount(cargar);

  async function cargar(): Promise<void> {
    cargando = true;
    const s = await obtenerShift(shiftId);
    if (!s) {
      cargando = false;
      return;
    }
    shift = s;
    producto = (await obtenerProducto(s.productId)) ?? null;
    unidad = (await obtenerUnidad(s.unitTypeId)) ?? null;
    const todos = await trabajadoresDeCuadrilla(s.crewId);
    workers = todos.filter((w) => s.attendeeIds.includes(w.id));
    entries = await entriesDeJornada(s.id);
    cargando = false;
  }

  function conteoDe(workerId: string): number {
    return conteos[workerId] ?? 0;
  }
  function entriesDeWorker(workerId: string): Entry[] {
    return entries
      .filter((e) => e.workerId === workerId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async function sumar(workerId: string, cantidad: number): Promise<void> {
    if (!shift || cantidad === 0) return;
    const entry = crearEntry({
      organizationId: shift.organizationId,
      shiftId: shift.id,
      workerId,
      cantidad,
      registradoPor: sesion.userId,
    });
    entries = [...entries, entry];
    try {
      await registrarEntry(entry);
    } catch (e) {
      entries = entries.filter((x) => x.id !== entry.id);
      console.error("[historial] no se pudo registrar", e);
    }
  }

  async function anular(entryId: string): Promise<void> {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.deleted === 1) return;
    const anterior = entries;
    entries = entries.map((e) => (e.id === entryId ? { ...e, deleted: 1 } : e));
    try {
      await anularEntry(entry);
    } catch (e) {
      entries = anterior;
      console.error("[historial] no se pudo anular", e);
    }
  }

  async function guardarPerfil(
    workerId: string,
    cambios: CambiosWorker,
  ): Promise<void> {
    const i = workers.findIndex((w) => w.id === workerId);
    if (i < 0) return;
    const actual = workers[i];
    const actualizado: Worker = {
      ...actual,
      name: cambios.name,
      alias: cambios.alias,
      language: cambios.language,
      activo: cambios.activo,
      updatedAt: Date.now(),
    };
    workers[i] = actualizado;
    try {
      await guardarWorker(actualizado);
    } catch (e) {
      workers[i] = actual;
      console.error("[historial] no se pudo guardar el trabajador", e);
    }
  }

  function pedirEditar(): void {
    confirmandoEditar = true;
  }
  function confirmarEditar(): void {
    modo = "edicion";
    confirmandoEditar = false;
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("historial.titulo")} />
    {#if infoParte}<p class="jornada-info">{infoParte}</p>{/if}
    {#if !cargando && shift}
      <div class="total">
        <span>{i18n.t("registro.total_jornada")}</span>
        <strong>{total}</strong>
      </div>
    {/if}
  </header>

  <div class="pantalla-cuerpo">
    {#if cargando}
      <p class="vacio-lista">{i18n.t("app.cargando")}</p>
    {:else if !shift}
      <p class="vacio-lista">{i18n.t("historial.no_encontrado")}</p>
    {:else if modo === "consulta"}
      <ul class="lista-simple">
        {#each workers as w (w.id)}
          <li class="hist-fila">
            <span class="nombre">{w.name}</span>
            <span class="conteo">{conteoDe(w.id)}</span>
          </li>
        {/each}
      </ul>

      {#if confirmandoEditar}
        <div class="confirm-inline">
          <span>{i18n.t("historial.aviso_editar")}</span>
          <div>
            <button
              type="button"
              class="btn-secundario"
              onclick={() => (confirmandoEditar = false)}
            >
              {i18n.t("pad.cancelar")}
            </button>
            <button
              type="button"
              class="btn-deshacer"
              onclick={confirmarEditar}
            >
              {i18n.t("historial.confirmar_editar")}
            </button>
          </div>
        </div>
      {:else}
        <button
          type="button"
          class="btn-secundario btn-ancho"
          onclick={pedirEditar}
        >
          {i18n.t("historial.editar")}
        </button>
      {/if}
    {:else}
      <ul class="lista">
        {#each workers as w (w.id)}
          <li>
            <WorkerRow
              worker={w}
              conteo={conteoDe(w.id)}
              onsumar={(n) => sumar(w.id, n)}
              onabrir={() => (workerAbiertoId = w.id)}
            />
          </li>
        {/each}
      </ul>
    {/if}

    <button type="button" class="btn-secundario btn-ancho" onclick={onclose}>
      {i18n.t("historial.volver")}
    </button>
  </div>

  {#if workerAbierto}
    {@const wa = workerAbierto}
    {#key wa.id}
      <WorkerSheet
        worker={wa}
        entries={entriesDeWorker(wa.id)}
        onsave={(cambios) => guardarPerfil(wa.id, cambios)}
        onanular={(entryId) => anular(entryId)}
        onclose={() => (workerAbiertoId = null)}
      />
    {/key}
  {/if}
</div>
