<script lang="ts">
  import { onMount } from "svelte";
  import type { Entry, Product, Shift, UnitType, Worker } from "@cuadrilla/shared";
  import { etiquetaProducto, sumarConteos } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";
  import { sesion } from "../stores/sesion.svelte";
  import type { CambiosWorker } from "../stores/jornada.svelte";
  import { obtenerShift, guardarShift } from "../db/repositories/shifts";
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
  import GroupSheet from "./GroupSheet.svelte";
  import EnviarAsistenciaSheet from "./EnviarAsistenciaSheet.svelte";
  import AuxiliarSheet from "./AuxiliarSheet.svelte";
  import CabeceraParte from "./CabeceraParte.svelte";

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
  let grupoAbiertoId = $state<string | null>(null);
  let auxAbiertoId = $state<string | null>(null);
  let enviarAsisAbierto = $state(false);

  const conteos = $derived(sumarConteos(entries));
  const total = $derived(Object.values(conteos).reduce((a, b) => a + b, 0));
  const grupos = $derived(shift?.groups ?? []);
  const trabajaPorGrupos = $derived(grupos.length > 0);

  const recolectores = $derived(
    workers.filter((w) => w.funcion !== "auxiliar"),
  );
  const auxiliares = $derived(
    workers
      .filter((w) => w.funcion === "auxiliar")
      .map((w) => {
        const a = shift?.auxiliares?.find((x) => x.workerId === w.id);
        return { worker: w, tarea: a?.tarea ?? "", horas: a?.horas ?? null };
      }),
  );
  const auxAbierto = $derived(
    auxAbiertoId
      ? (auxiliares.find((a) => a.worker.id === auxAbiertoId) ?? null)
      : null,
  );
  const workerAbierto = $derived(
    workerAbiertoId
      ? (workers.find((w) => w.id === workerAbiertoId) ?? null)
      : null,
  );
  const grupoAbierto = $derived(
    grupoAbiertoId
      ? (grupos.find((g) => g.groupId === grupoAbiertoId) ?? null)
      : null,
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

  function conteoDe(id: string): number {
    return conteos[id] ?? 0;
  }
  function entriesDe(id: string): Entry[] {
    return entries
      .filter((e) => e.workerId === id || e.groupId === id)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async function sumar(id: string, cantidad: number): Promise<void> {
    if (!shift || cantidad === 0) return;
    const esGrupo = grupos.some((g) => g.groupId === id);
    const entry = crearEntry({
      organizationId: shift.organizationId,
      shiftId: shift.id,
      workerId: esGrupo ? undefined : id,
      groupId: esGrupo ? id : undefined,
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

  async function actualizarGrupo(
    groupId: string,
    memberIds: string[],
  ): Promise<void> {
    if (!shift?.groups) return;
    const anterior = shift;
    const actualizado: Shift = {
      ...shift,
      groups: shift.groups.map((g) =>
        g.groupId === groupId ? { ...g, memberIds: [...memberIds] } : g,
      ),
      updatedAt: Date.now(),
    };
    shift = actualizado;
    try {
      await guardarShift(actualizado);
    } catch (e) {
      shift = anterior;
      console.error("[historial] no se pudo actualizar el grupo", e);
    }
  }

  async function actualizarAuxiliar(
    workerId: string,
    datos: { tarea: string; horas: number | null },
  ): Promise<void> {
    if (!shift) return;
    const anterior = shift;
    const tarea = datos.tarea.trim();
    const horas =
      datos.horas != null && Number.isFinite(datos.horas) && datos.horas > 0
        ? datos.horas
        : undefined;
    const otros = (shift.auxiliares ?? []).filter(
      (a) => a.workerId !== workerId,
    );
    const entrada = { workerId, tarea: tarea || undefined, horas };
    const auxiliares =
      entrada.tarea || entrada.horas != null ? [...otros, entrada] : otros;
    const actualizado: Shift = { ...shift, auxiliares, updatedAt: Date.now() };
    shift = actualizado;
    try {
      await guardarShift(actualizado);
    } catch (e) {
      shift = anterior;
      console.error("[historial] no se pudo guardar el auxiliar", e);
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

  function resumenAux(a: { tarea: string; horas: number | null }): string {
    const partes: string[] = [];
    if (a.tarea) partes.push(a.tarea);
    if (a.horas != null) partes.push(i18n.t("auxiliar.n_horas", { n: a.horas }));
    return partes.length ? partes.join(" · ") : i18n.t("auxiliar.sin_datos");
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
    {#if shift && producto && unidad}
      <CabeceraParte
        fecha={shift.fecha}
        finca={shift.finca}
        producto={etiquetaProducto(producto)}
        unidad={unidad.name}
        nRecolectores={recolectores.length}
        nAuxiliares={auxiliares.length}
      />
    {/if}
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
        {#if trabajaPorGrupos}
          {#each grupos as g (g.groupId)}
            <li class="hist-fila">
              <span class="nombre">{g.name}</span>
              <span class="conteo">{conteoDe(g.groupId)}</span>
            </li>
          {/each}
        {:else}
          {#each recolectores as w (w.id)}
            <li class="hist-fila">
              <span class="nombre">{w.name}</span>
              <span class="conteo">{conteoDe(w.id)}</span>
            </li>
          {/each}
        {/if}
        {#each auxiliares as a (a.worker.id)}
          <li class="hist-fila hist-fila-aux">
            <span class="nombre">{a.worker.name}</span>
            <span class="hist-aux-sub">{resumenAux(a)}</span>
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
    {:else if trabajaPorGrupos}
      <ul class="lista">
        {#each grupos as g (g.groupId)}
          <li>
            <WorkerRow
              item={{
                name: g.name,
                alias: i18n.t("grupo.miembros_contador", {
                  n: g.memberIds.length,
                }),
              }}
              conteo={conteoDe(g.groupId)}
              onsumar={(n) => sumar(g.groupId, n)}
              onabrir={() => (grupoAbiertoId = g.groupId)}
            />
          </li>
        {/each}
      </ul>
    {:else}
      <ul class="lista">
        {#each recolectores as w (w.id)}
          <li>
            <WorkerRow
              item={w}
              conteo={conteoDe(w.id)}
              onsumar={(n) => sumar(w.id, n)}
              onabrir={() => (workerAbiertoId = w.id)}
            />
          </li>
        {/each}
      </ul>
    {/if}

    {#if modo === "edicion" && auxiliares.length > 0}
      <ul class="lista">
        <li class="aux-cab">{i18n.t("auxiliar.seccion")}</li>
        {#each auxiliares as a (a.worker.id)}
          <li>
            <button
              type="button"
              class="aux-fila"
              onclick={() => (auxAbiertoId = a.worker.id)}
            >
              <span class="aux-nombre">{a.worker.name}</span>
              <span class="aux-sub">{resumenAux(a)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if shift && (shift.firma || shift.firmante)}
      <h3>{i18n.t("firma.titulo")}</h3>
      {#if shift.firma}
        <img class="firma-vista" src={shift.firma} alt={i18n.t("firma.titulo")} />
      {/if}
      {#if shift.firmante}
        <p class="firma-firmante">
          {i18n.t("firma.firmante", { nombre: shift.firmante })}
        </p>
      {/if}
    {/if}

    {#if !cargando && shift && modo === "consulta"}
      <button
        type="button"
        class="btn-secundario btn-ancho"
        onclick={() => (enviarAsisAbierto = true)}
      >
        {i18n.t("enviar_asis.abrir")}
      </button>
    {/if}

    <button type="button" class="btn-secundario btn-ancho" onclick={onclose}>
      {i18n.t("historial.volver")}
    </button>
  </div>

  {#if enviarAsisAbierto && shift}
    <EnviarAsistenciaSheet
      {shift}
      {workers}
      producto={etiquetaProducto(producto)}
      unidad={unidad?.name ?? ""}
      grupos={trabajaPorGrupos ? grupos : undefined}
      onclose={() => (enviarAsisAbierto = false)}
    />
  {/if}

  {#if auxAbierto}
    {@const aa = auxAbierto}
    {#key aa.worker.id}
      <AuxiliarSheet
        aux={aa}
        soloLectura={modo === "consulta"}
        onsave={(datos) => actualizarAuxiliar(aa.worker.id, datos)}
        onclose={() => (auxAbiertoId = null)}
      />
    {/key}
  {/if}

  {#if workerAbierto}
    {@const wa = workerAbierto}
    {#key wa.id}
      <WorkerSheet
        worker={wa}
        entries={entriesDe(wa.id)}
        onsave={(cambios) => guardarPerfil(wa.id, cambios)}
        onanular={(entryId) => anular(entryId)}
        onclose={() => (workerAbiertoId = null)}
      />
    {/key}
  {/if}

  {#if grupoAbierto}
    {@const ga = grupoAbierto}
    {#key ga.groupId}
      <GroupSheet
        group={ga}
        {workers}
        entries={entriesDe(ga.groupId)}
        onmembers={(memberIds) => actualizarGrupo(ga.groupId, memberIds)}
        onanular={(entryId) => anular(entryId)}
        onclose={() => (grupoAbiertoId = null)}
      />
    {/key}
  {/if}
</div>
