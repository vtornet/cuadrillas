<script lang="ts">
  import { onMount } from "svelte";
  import type { Entry, Shift, Worker } from "@cuadrilla/shared";
  import {
    informeAsistencia,
    informeParte,
    informeParteHoras,
    type CabeceraInforme,
  } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";
  import { perfil } from "../stores/perfil.svelte";
  import { obtenerCrew } from "../db/repositories/crews";
  import { textoAsistenciaParte } from "../export/asistenciaParte";
  import { asistenciaAPdf, parteAPdf, parteHorasAPdf } from "../export/pdf";
  import { asistenciaAXlsx, parteAXlsx, parteHorasAXlsx } from "../export/xlsx";
  import { docAsistencia, docParte, docParteHoras } from "../export/documento";
  import { compartirArchivo, slug } from "../export/compartir";
  import PreviaDocumento from "./PreviaDocumento.svelte";

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
    await perfil.cargar();
  });

  const cabecera = $derived<CabeceraInforme>({
    empresa: perfil.empresa || undefined,
    nif: perfil.org?.taxId,
    cuadrilla,
    finca: shift.finca,
    observaciones: shift.observaciones,
    fecha: shift.fecha,
    horaInicio: shift.horaInicio,
    horaFin: shift.horaFin,
    producto,
    unidad,
    firmante: shift.firmante,
    firmaPng: shift.firma,
  });

  const porHoras = $derived(shift.modo === "horas");
  const infAsistencia = $derived(informeAsistencia(cabecera, shift, workers));
  const infParte = $derived(informeParte(cabecera, shift, workers, entries));
  const infParteHoras = $derived(informeParteHoras(cabecera, shift, workers));
  const texto = $derived(textoAsistenciaParte(infAsistencia));

  /** Informe cuya previa está abierta (null = sin previa). */
  let previa = $state<"asistencia" | "parte" | null>(null);
  const docPrevia = $derived(
    previa === "asistencia"
      ? docAsistencia(infAsistencia)
      : previa === "parte"
        ? porHoras
          ? docParteHoras(infParteHoras)
          : docParte(infParte)
        : null,
  );

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

  /** Genera y comparte/descarga el informe cuya previa está abierta. */
  async function exportarPrevia(ext: "pdf" | "xlsx"): Promise<void> {
    if (!previa || generando) return;
    const tipo = previa;
    const gen: () => Promise<Blob> =
      ext === "pdf"
        ? tipo === "asistencia"
          ? () => asistenciaAPdf(infAsistencia)
          : porHoras
            ? () => parteHorasAPdf(infParteHoras)
            : () => parteAPdf(infParte)
        : tipo === "asistencia"
          ? () => asistenciaAXlsx(infAsistencia)
          : porHoras
            ? () => parteHorasAXlsx(infParteHoras)
            : () => parteAXlsx(infParte);
    await archivo(ext === "pdf" ? "pdf" : "xls", tipo, ext, gen);
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
      <section class="cmp-bloque">
      <h3 class="cmp-seccion">{i18n.t("compartir.asistencia")}</h3>
      <p class="cmp-ayuda">{i18n.t("compartir.asistencia_ayuda")}</p>
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
          class="btn-secundario cmp-ancho"
          onclick={() => (previa = "asistencia")}
        >
          {i18n.t("compartir.ver_exportar")}
        </button>
      </div>
      </section>

      <section class="cmp-bloque">
      <h3 class="cmp-seccion">{i18n.t("compartir.parte")}</h3>
      <p class="cmp-ayuda">{i18n.t("compartir.parte_ayuda")}</p>
      <button
        type="button"
        class="btn-secundario btn-ancho"
        onclick={() => (previa = "parte")}
      >
        {i18n.t("compartir.ver_exportar")}
      </button>
      </section>
    </div>

    <div class="hoja-pie">
      <button type="button" class="btn-primario" onclick={onclose}>
        {i18n.t("worker.cerrar")}
      </button>
    </div>
  </div>
</div>

{#if docPrevia}
  <PreviaDocumento
    documento={docPrevia}
    {generando}
    onpdf={() => exportarPrevia("pdf")}
    onexcel={() => exportarPrevia("xlsx")}
    onclose={() => (previa = null)}
  />
{/if}

<style>
  .cmp-bloque {
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    padding: 12px;
    margin-bottom: 14px;
  }
  .cmp-bloque:last-child {
    margin-bottom: 4px;
  }
  .cmp-seccion {
    margin: 0 0 4px;
    font-size: 15px;
  }
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
  }
  .cmp-bloque .cmp-texto:last-of-type {
    margin-bottom: 12px;
  }
  .cmp-acciones button {
    width: 100%;
  }
  .cmp-acciones .cmp-ancho {
    grid-column: 1 / -1;
  }
</style>
