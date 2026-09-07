<script lang="ts">
  import { jornada } from "../lib/stores/jornada.svelte";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import AppBar from "../lib/components/AppBar.svelte";
  import WorkerRow from "../lib/components/WorkerRow.svelte";
  import WorkerSheet from "../lib/components/WorkerSheet.svelte";
  import GroupSheet from "../lib/components/GroupSheet.svelte";
  import QrScanner from "../lib/components/QrScanner.svelte";
  import ComenzarJornadaSheet from "../lib/components/ComenzarJornadaSheet.svelte";
  import FirmaSheet from "../lib/components/FirmaSheet.svelte";
  import EnviarAsistenciaSheet from "../lib/components/EnviarAsistenciaSheet.svelte";

  let q = $state("");
  let scannerAbierto = $state(false);
  let workerAbiertoId = $state<string | null>(null);
  let grupoAbiertoId = $state<string | null>(null);
  let comenzarAbierto = $state(false);
  let firmaAbierta = $state(false);
  let enviarAsisAbierto = $state(false);

  const visiblesWorkers = $derived.by(() => {
    const t = q.trim().toLowerCase();
    if (!t) return jornada.workers;
    return jornada.workers.filter(
      (w) =>
        w.name.toLowerCase().includes(t) || w.alias.toLowerCase().includes(t),
    );
  });

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

  const infoJornada = $derived(
    jornada.producto && jornada.unidad && jornada.shift
      ? i18n.t("registro.jornada_info", {
          producto: jornada.producto.name,
          unidad: jornada.unidad.name,
          fecha: jornada.shift.fecha,
        })
      : "",
  );

  async function onScan(texto: string): Promise<void> {
    scannerAbierto = false;
    const limpio = texto.trim().toLowerCase();
    const w = jornada.workers.find(
      (x) => x.qrCode === texto || x.alias.toLowerCase() === limpio,
    );
    if (!w) return;
    if (!jornada.trabajaPorGrupos) {
      await jornada.sumar(w.id, 1);
      return;
    }
    const grupo = jornada.grupos.find((g) => g.memberIds.includes(w.id));
    if (grupo) await jornada.sumar(grupo.groupId, 1);
  }

  async function finalizar(firma?: string, firmante?: string): Promise<void> {
    await jornada.cerrarActual(firma, firmante);
    firmaAbierta = false;
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
      {#if infoJornada}
        <p class="jornada-info">{infoJornada}</p>
      {/if}
      <button
        type="button"
        class="enviar-asis-link"
        onclick={() => (enviarAsisAbierto = true)}
      >
        {i18n.t("enviar_asis.abrir")}
      </button>
      <div class="total">
        <span>{i18n.t("registro.total_jornada")}</span>
        <strong>{jornada.total}</strong>
      </div>
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
      {#if jornada.trabajaPorGrupos}
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

      <li class="finalizar-item">
        <button
          type="button"
          class="btn-deshacer finalizar-btn"
          onclick={() => (firmaAbierta = true)}
        >
          {i18n.t("registro.finalizar_jornada")}
        </button>
      </li>
    </ul>

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

    {#if scannerAbierto}
      <QrScanner ondetect={onScan} onclose={() => (scannerAbierto = false)} />
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

    {#if firmaAbierta}
      <FirmaSheet
        onfinalizar={(firma, firmante) => finalizar(firma, firmante)}
        onclose={() => (firmaAbierta = false)}
      />
    {/if}

    {#if enviarAsisAbierto && jornada.shift}
      <EnviarAsistenciaSheet
        shift={jornada.shift}
        workers={jornada.workers}
        producto={jornada.producto?.name ?? ""}
        unidad={jornada.unidad?.name ?? ""}
        grupos={jornada.trabajaPorGrupos ? jornada.grupos : undefined}
        onclose={() => (enviarAsisAbierto = false)}
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
