<script lang="ts">
  import { etiquetaProducto } from "@cuadrilla/shared/domain";
  import { jornada } from "../lib/stores/jornada.svelte";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import AppBar from "../lib/components/AppBar.svelte";
  import WorkerRow from "../lib/components/WorkerRow.svelte";
  import HorasRow from "../lib/components/HorasRow.svelte";
  import AplicarHorasATodos from "../lib/components/AplicarHorasATodos.svelte";
  import TotalEnvasesParte from "../lib/components/TotalEnvasesParte.svelte";
  import WorkerSheet from "../lib/components/WorkerSheet.svelte";
  import GroupSheet from "../lib/components/GroupSheet.svelte";
  import QrScanner from "../lib/components/QrScanner.svelte";
  import ComenzarJornadaSheet from "../lib/components/ComenzarJornadaSheet.svelte";
  import FirmaSheet from "../lib/components/FirmaSheet.svelte";
  import CompartirParteSheet from "../lib/components/CompartirParteSheet.svelte";
  import AuxiliarSheet from "../lib/components/AuxiliarSheet.svelte";
  import AvisoSinAnotarSheet from "../lib/components/AvisoSinAnotarSheet.svelte";
  import CabeceraParte from "../lib/components/CabeceraParte.svelte";
  import ObservacionesParte from "../lib/components/ObservacionesParte.svelte";

  let q = $state("");
  let scannerAbierto = $state(false);
  let workerAbiertoId = $state<string | null>(null);
  let grupoAbiertoId = $state<string | null>(null);
  let auxAbiertoId = $state<string | null>(null);
  let comenzarAbierto = $state(false);
  let firmaAbierta = $state(false);
  let avisoSinAnotar = $state(false);
  let compartirAbierto = $state(false);

  function intentarFinalizar(): void {
    if (jornada.sinAnotar.length === 0) firmaAbierta = true;
    else avisoSinAnotar = true;
  }

  const visiblesWorkers = $derived.by(() => {
    const t = q.trim().toLowerCase();
    if (!t) return jornada.recolectores;
    return jornada.recolectores.filter(
      (w) =>
        w.name.toLowerCase().includes(t) || w.alias.toLowerCase().includes(t),
    );
  });

  const visiblesAux = $derived.by(() => {
    const t = q.trim().toLowerCase();
    if (!t) return jornada.auxiliares;
    return jornada.auxiliares.filter((a) =>
      a.worker.name.toLowerCase().includes(t) ||
      a.worker.alias.toLowerCase().includes(t),
    );
  });

  const auxAbierto = $derived(
    auxAbiertoId
      ? (jornada.auxiliares.find((a) => a.worker.id === auxAbiertoId) ?? null)
      : null,
  );

  const visiblesGrupos = $derived.by(() => {
    const t = q.trim().toLowerCase();
    if (!t) return jornada.grupos;
    return jornada.grupos.filter((g) => g.name.toLowerCase().includes(t));
  });

  const workerAbierto = $derived(
    workerAbiertoId
      ? (jornada.workers.find((w) => w.id === workerAbiertoId) ?? null)
      : null,
  );

  const grupoAbierto = $derived(
    grupoAbiertoId
      ? (jornada.grupos.find((g) => g.groupId === grupoAbiertoId) ?? null)
      : null,
  );


  async function onScan(texto: string): Promise<void> {
    scannerAbierto = false;
    const limpio = texto.trim().toLowerCase();
    const w = jornada.workers.find(
      (x) => x.qrCode === texto || x.alias.toLowerCase() === limpio,
    );
    if (!w || w.funcion === "auxiliar") return;
    if (!jornada.trabajaPorGrupos) {
      await jornada.sumar(w.id, 1);
      return;
    }
    const grupo = jornada.grupos.find((g) => g.memberIds.includes(w.id));
    if (grupo) await jornada.sumar(grupo.groupId, 1);
  }

  async function finalizar(
    firma?: string,
    firmante?: string,
    horaFin?: string,
  ): Promise<void> {
    await jornada.cerrarActual(firma, firmante, horaFin);
    firmaAbierta = false;
  }

  function resumenAux(a: { tarea: string; horas: number | null }): string {
    const partes: string[] = [];
    if (a.tarea) partes.push(a.tarea);
    if (a.horas != null) partes.push(i18n.t("auxiliar.n_horas", { n: a.horas }));
    return partes.length ? partes.join(" · ") : i18n.t("auxiliar.sin_datos");
  }
</script>

<div class="pantalla">
  {#if !jornada.hayJornada}
    <header class="cabecera">
      <AppBar titulo={i18n.t("app.nombre")} />
    </header>
    <div class="vacio">
      <h1>{i18n.t("registro.sin_jornada")}</h1>
      <p>{i18n.t("registro.sin_jornada_ayuda")}</p>
      <button
        type="button"
        class="btn-primario"
        onclick={() => (comenzarAbierto = true)}
      >
        {i18n.t("registro.comenzar_jornada")}
      </button>
    </div>
  {:else}
    <header class="cabecera">
      <AppBar titulo={i18n.t("app.nombre")} />
      {#if jornada.shift && jornada.producto && jornada.unidad}
        <CabeceraParte
          fecha={jornada.shift.fecha}
          finca={jornada.shift.finca}
          producto={etiquetaProducto(jornada.producto)}
          unidad={jornada.unidad.name}
          horaInicio={jornada.shift.horaInicio}
          horaFin={jornada.shift.horaFin}
          nRecolectores={jornada.recolectores.length}
          nAuxiliares={jornada.auxiliares.length}
          porHoras={jornada.porHoras}
        />
      {/if}
      <button
        type="button"
        class="compartir-link"
        onclick={() => (compartirAbierto = true)}
      >
        {i18n.t("compartir.abrir")}
      </button>
      {#if !jornada.porHoras}
        <div class="total">
          <span>{i18n.t("registro.total_jornada")}</span>
          <strong>{jornada.total}</strong>
        </div>
      {/if}
      <input
        class="buscar"
        type="search"
        inputmode="search"
        autocomplete="off"
        placeholder={i18n.t("registro.buscar")}
        bind:value={q}
      />
    </header>

    <ul class="lista">
      {#if jornada.porHoras}
        <li>
          <AplicarHorasATodos onaplicar={(h) => jornada.aplicarHorasATodos(h)} />
        </li>
        {#each visiblesWorkers as w (w.id)}
          <li>
            <HorasRow
              item={w}
              horas={jornada.horasDe(w.id)}
              onhoras={(h) => jornada.actualizarHorasRecolector(w.id, h)}
              onabrir={() => (workerAbiertoId = w.id)}
            />
          </li>
        {:else}
          <li class="vacio-busqueda">{i18n.t("registro.sin_resultados")}</li>
        {/each}
      {:else if jornada.trabajaPorGrupos}
        {#each visiblesGrupos as g (g.groupId)}
          <li>
            <WorkerRow
              item={{
                name: g.name,
                alias: i18n.t("grupo.miembros_contador", {
                  n: g.memberIds.length,
                }),
              }}
              conteo={jornada.conteoDe(g.groupId)}
              onsumar={(n) => jornada.sumar(g.groupId, n)}
              onabrir={() => (grupoAbiertoId = g.groupId)}
            />
          </li>
        {:else}
          <li class="vacio-busqueda">{i18n.t("registro.sin_resultados")}</li>
        {/each}
      {:else}
        {#each visiblesWorkers as w (w.id)}
          <li>
            <WorkerRow
              item={w}
              conteo={jornada.conteoDe(w.id)}
              onsumar={(n) => jornada.sumar(w.id, n)}
              onabrir={() => (workerAbiertoId = w.id)}
            />
          </li>
        {:else}
          <li class="vacio-busqueda">{i18n.t("registro.sin_resultados")}</li>
        {/each}
      {/if}

      {#if visiblesAux.length > 0}
        <li class="aux-cab">{i18n.t("auxiliar.seccion")}</li>
        {#each visiblesAux as a (a.worker.id)}
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
      {/if}

      {#if jornada.porHoras}
        <li class="obs-item">
          <TotalEnvasesParte
            total={jornada.totalEnvases}
            numRecolectores={jornada.recolectores.length}
            onguardar={(t) => jornada.actualizarTotalEnvases(t)}
          />
        </li>
      {/if}

      <li class="obs-item">
        <ObservacionesParte
          valor={jornada.shift?.observaciones ?? ""}
          onguardar={(t) => jornada.actualizarObservaciones(t)}
        />
      </li>

      <li class="finalizar-item">
        <button
          type="button"
          class="btn-deshacer finalizar-btn"
          onclick={intentarFinalizar}
        >
          {i18n.t("registro.finalizar_jornada")}
        </button>
      </li>
    </ul>

    {#if !jornada.porHoras}
      <div class="acciones">
        <button
          type="button"
          class="btn-secundario"
          onclick={() => (scannerAbierto = true)}
        >
          {i18n.t("registro.escanear")}
        </button>
        <button
          type="button"
          class="btn-deshacer"
          disabled={!jornada.puedeDeshacer}
          onclick={() => jornada.deshacer()}
        >
          {i18n.t("registro.deshacer")}
        </button>
      </div>
    {/if}

    {#if scannerAbierto}
      <QrScanner ondetect={onScan} onclose={() => (scannerAbierto = false)} />
    {/if}

    {#if auxAbierto}
      {@const aa = auxAbierto}
      {#key aa.worker.id}
        <AuxiliarSheet
          aux={aa}
          onsave={(datos) => jornada.actualizarAuxiliar(aa.worker.id, datos)}
          onclose={() => (auxAbiertoId = null)}
        />
      {/key}
    {/if}

    {#if workerAbierto}
      {@const wa = workerAbierto}
      {#key wa.id}
        <WorkerSheet
          worker={wa}
          entries={jornada.entriesDe(wa.id)}
          onsave={(cambios) => jornada.guardarTrabajador(wa.id, cambios)}
          onanular={(entryId) => jornada.anularAnotacion(entryId)}
          onclose={() => (workerAbiertoId = null)}
        />
      {/key}
    {/if}

    {#if grupoAbierto}
      {@const ga = grupoAbierto}
      {#key ga.groupId}
        <GroupSheet
          group={ga}
          workers={jornada.workers}
          entries={jornada.entriesDe(ga.groupId)}
          onmembers={(memberIds) =>
            jornada.actualizarGrupoDeHoy(ga.groupId, memberIds)}
          onanular={(entryId) => jornada.anularAnotacion(entryId)}
          onclose={() => (grupoAbiertoId = null)}
        />
      {/key}
    {/if}

    {#if avisoSinAnotar}
      <AvisoSinAnotarSheet
        nombres={jornada.sinAnotar}
        onseguir={() => {
          avisoSinAnotar = false;
          firmaAbierta = true;
        }}
        onvolver={() => (avisoSinAnotar = false)}
      />
    {/if}

    {#if firmaAbierta}
      <FirmaSheet
        horaInicio={jornada.shift?.horaInicio}
        onfinalizar={(firma, firmante, horaFin) =>
          finalizar(firma, firmante, horaFin)}
        onclose={() => (firmaAbierta = false)}
      />
    {/if}

    {#if compartirAbierto && jornada.shift}
      <CompartirParteSheet
        shift={jornada.shift}
        workers={jornada.workers}
        entries={jornada.entries}
        producto={etiquetaProducto(jornada.producto)}
        unidad={jornada.unidad?.name ?? ""}
        onclose={() => (compartirAbierto = false)}
      />
    {/if}
  {/if}

  {#if comenzarAbierto}
    <ComenzarJornadaSheet
      onclose={() => (comenzarAbierto = false)}
      oncomenzado={() => (comenzarAbierto = false)}
    />
  {/if}
</div>
