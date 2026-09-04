<script lang="ts">
  import { jornada } from "../lib/stores/jornada.svelte";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { router } from "../lib/stores/router.svelte";
  import AppBar from "../lib/components/AppBar.svelte";
  import WorkerRow from "../lib/components/WorkerRow.svelte";
  import WorkerSheet from "../lib/components/WorkerSheet.svelte";
  import QrScanner from "../lib/components/QrScanner.svelte";

  let q = $state("");
  let scannerAbierto = $state(false);
  let workerAbiertoId = $state<string | null>(null);

  const visibles = $derived.by(() => {
    const t = q.trim().toLowerCase();
    if (!t) return jornada.workers;
    return jornada.workers.filter(
      (w) =>
        w.name.toLowerCase().includes(t) || w.alias.toLowerCase().includes(t),
    );
  });

  const workerAbierto = $derived(
    workerAbiertoId
      ? (jornada.workers.find((w) => w.id === workerAbiertoId) ?? null)
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
    if (w) await jornada.sumar(w.id, 1);
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
        onclick={() => router.ir("jornada")}
      >
        {i18n.t("registro.abrir_jornada")}
      </button>
    </div>
  {:else}
    <header class="cabecera">
      <AppBar titulo={i18n.t("app.nombre")} />
      {#if infoJornada}
        <button
          type="button"
          class="jornada-info"
          onclick={() => router.ir("jornada")}
        >
          {infoJornada}<span class="chevron" aria-hidden="true">&rsaquo;</span>
        </button>
      {/if}
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
      {#each visibles as w (w.id)}
        <li>
          <WorkerRow
            worker={w}
            conteo={jornada.conteoDe(w.id)}
            onsumar={(n) => jornada.sumar(w.id, n)}
            onabrir={() => (workerAbiertoId = w.id)}
          />
        </li>
      {:else}
        <li class="vacio-busqueda">{i18n.t("registro.sin_resultados")}</li>
      {/each}
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
          entries={jornada.entriesDeWorker(wa.id)}
          onsave={(cambios) => jornada.guardarTrabajador(wa.id, cambios)}
          onanular={(entryId) => jornada.anularAnotacion(entryId)}
          onclose={() => (workerAbiertoId = null)}
        />
      {/key}
    {/if}
  {/if}
</div>
