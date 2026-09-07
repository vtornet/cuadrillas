<script lang="ts">
  import { onMount } from "svelte";
  import type { Entry, Shift, Worker } from "@cuadrilla/shared";
  import {
    informeAsistencia,
    informeParte,
    type CabeceraInforme,
  } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";
  import { obtenerCrew } from "../db/repositories/crews";
  import { textoAsistenciaParte } from "../export/asistenciaParte";
  import { asistenciaAPdf, parteAPdf } from "../export/pdf";
  import { asistenciaAXlsx, parteAXlsx } from "../export/xlsx";
  import { compartirArchivo, slug } from "../export/compartir";

  let {
    shift,
    workers,
    entries,
    producto,
    unidad,
    onclose,
  }: {
    shift: Shift;
    /** Trabajadores presentes en el parte. */
    workers: Worker[];
    /** Anotaciones de la jornada (para el parte de trabajo completo). */
    entries: Entry[];
    /** Etiqueta del producto ("Naranja · Navelina"). */
    producto: string;
    unidad: string;
    onclose: () => void;
  } = $props();

  let cuadrilla = $state("");
  let copiado = $state(false);
  /** Clave de la acción de archivo en curso, p. ej. "asistencia-pdf". */
  let generando = $state<string | null>(null);

  onMount(async () => {
    cuadrilla = (await obtenerCrew(shift.crewId))?.name ?? "";
  });

  const cabecera = $derived<CabeceraInforme>({
    cuadrilla,
    finca: shift.finca,
    fecha: shift.fecha,
    producto,
    unidad,
    firmante: shift.firmante,
    firmaPng: shift.firma,
  });

  const infAsistencia = $derived(informeAsistencia(cabecera, shift, workers));
  const infParte = $derived(informeParte(cabecera, shift, workers, entries));
  const texto = $derived(textoAsistenciaParte(infAsistencia));

  function whatsapp(): void {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function email(): void {
    const asunto = i18n.t("compartir.asunto", { cuadrilla, fecha: shift.fecha });
    window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
  }

  async function compartirTexto(): Promise<void> {
    try {
      await navigator.share({ text: texto });
    } catch {
      /* cancelado o no soportado */
    }
  }

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      copiado = true;
      return;
    } catch {
      /* fallback clásico */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      copiado = document.execCommand("copy");
      ta.remove();
    } catch (e) {
      console.error("[compartir] copiar", e);
    }
  }

  async function archivo(
    clave: string,
    tipo: "asistencia" | "parte",
    ext: "pdf" | "xlsx",
    gen: () => Promise<Blob>,
  ): Promise<void> {
    if (generando) return;
    generando = clave;
    try {
      const blob = await gen();
      const nombre = `${tipo}_${slug(cuadrilla || "cuadrilla")}_${shift.fecha}.${ext}`;
      await compartirArchivo(blob, nombre);
    } catch (e) {
      console.error("[compartir]", clave, e);
    } finally {
      generando = null;
    }
  }

  const puedeCompartir =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={i18n.t("compartir.titulo")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("compartir.titulo")}</h2>
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
      <h3 class="cmp-seccion">{i18n.t("compartir.asistencia")}</h3>
      <pre class="cmp-texto">{texto}</pre>

      <div class="cmp-acciones">
        <button type="button" class="btn-secundario" onclick={copiar}>
          {copiado ? i18n.t("compartir.copiado") : i18n.t("compartir.copiar")}
        </button>
        <button type="button" class="btn-secundario" onclick={whatsapp}>
          {i18n.t("compartir.whatsapp")}
        </button>
        <button type="button" class="btn-secundario" onclick={email}>
          {i18n.t("compartir.email")}
        </button>
        {#if puedeCompartir}
          <button type="button" class="btn-secundario" onclick={compartirTexto}>
            {i18n.t("compartir.texto")}
          </button>
        {/if}
        <button
          type="button"
          class="btn-secundario"
          disabled={!!generando}
          onclick={() =>
            archivo("a-pdf", "asistencia", "pdf", () => asistenciaAPdf(infAsistencia))}
        >
          {generando === "a-pdf" ? i18n.t("compartir.generando") : i18n.t("compartir.pdf")}
        </button>
        <button
          type="button"
          class="btn-secundario"
          disabled={!!generando}
          onclick={() =>
            archivo("a-xls", "asistencia", "xlsx", () => asistenciaAXlsx(infAsistencia))}
        >
          {generando === "a-xls" ? i18n.t("compartir.generando") : i18n.t("compartir.excel")}
        </button>
      </div>

      <h3 class="cmp-seccion">{i18n.t("compartir.parte")}</h3>
      <p class="cmp-ayuda">{i18n.t("compartir.parte_ayuda")}</p>
      <div class="cmp-acciones">
        <button
          type="button"
          class="btn-secundario"
          disabled={!!generando}
          onclick={() => archivo("p-pdf", "parte", "pdf", () => parteAPdf(infParte))}
        >
          {generando === "p-pdf" ? i18n.t("compartir.generando") : i18n.t("compartir.pdf")}
        </button>
        <button
          type="button"
          class="btn-secundario"
          disabled={!!generando}
          onclick={() => archivo("p-xls", "parte", "xlsx", () => parteAXlsx(infParte))}
        >
          {generando === "p-xls" ? i18n.t("compartir.generando") : i18n.t("compartir.excel")}
        </button>
      </div>
    </div>

    <div class="hoja-pie">
      <button type="button" class="btn-primario" onclick={onclose}>
        {i18n.t("worker.cerrar")}
      </button>
    </div>
  </div>
</div>

<style>
  .cmp-seccion {
    margin: 4px 0 8px;
    font-size: 15px;
  }
  .cmp-seccion + .cmp-texto,
  .cmp-seccion + .cmp-ayuda {
    margin-top: 0;
  }
  .cmp-texto {
    white-space: pre-wrap;
    word-break: break-word;
    font: inherit;
    background: var(--c-fondo);
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    padding: 12px;
    margin: 0 0 12px;
    max-height: 32vh;
    overflow-y: auto;
  }
  .cmp-ayuda {
    margin: 0 0 10px;
    font-size: 14px;
    color: var(--c-texto-suave);
  }
  .cmp-acciones {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 18px;
  }
  .cmp-acciones button {
    width: 100%;
  }
</style>
