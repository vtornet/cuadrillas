<script lang="ts">
  import { onMount } from "svelte";
  import type { GrupoDeJornada, Shift, Worker } from "@cuadrilla/shared";
  import { i18n } from "../i18n/i18n.svelte";
  import { obtenerCrew } from "../db/repositories/crews";
  import {
    textoAsistenciaParte,
    type DatosAsistenciaParte,
  } from "../export/asistenciaParte";

  let {
    shift,
    workers,
    producto,
    unidad,
    grupos,
    onclose,
  }: {
    shift: Shift;
    /** Trabajadores presentes en el parte. */
    workers: Worker[];
    producto: string;
    unidad: string;
    grupos?: GrupoDeJornada[];
    onclose: () => void;
  } = $props();

  let cuadrilla = $state("");
  let copiado = $state(false);

  onMount(async () => {
    cuadrilla = (await obtenerCrew(shift.crewId))?.name ?? "";
  });

  const nombrePorId = $derived(
    new Map(workers.map((w) => [w.id, w.name])),
  );

  const datos = $derived<DatosAsistenciaParte>({
    cuadrilla,
    fecha: shift.fecha,
    producto,
    unidad,
    nombres: workers.map((w) => w.name),
    grupos: grupos?.map((g) => ({
      nombre: g.name,
      miembros: g.memberIds.map((id) => nombrePorId.get(id) ?? "?"),
    })),
  });

  const texto = $derived(textoAsistenciaParte(datos));

  function whatsapp(): void {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function email(): void {
    const asunto = i18n.t("enviar_asis.asunto", {
      cuadrilla,
      fecha: shift.fecha,
    });
    window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
  }

  async function compartir(): Promise<void> {
    try {
      await navigator.share({ text: texto });
    } catch {
      /* el usuario canceló o falló: sin acción */
    }
  }

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      copiado = true;
      return;
    } catch {
      /* sin Clipboard API o sin permiso: probamos el método clásico */
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
      console.error("[enviar-asis] copiar", e);
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
  aria-label={i18n.t("enviar_asis.titulo")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("enviar_asis.titulo")}</h2>
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
      <pre class="enviar-asis-texto">{texto}</pre>

      <div class="enviar-asis-acciones">
        <button type="button" class="btn-secundario" onclick={copiar}>
          {copiado ? i18n.t("enviar_asis.copiado") : i18n.t("enviar_asis.copiar")}
        </button>
        <button type="button" class="btn-secundario" onclick={whatsapp}>
          {i18n.t("enviar_asis.whatsapp")}
        </button>
        <button type="button" class="btn-secundario" onclick={email}>
          {i18n.t("enviar_asis.email")}
        </button>
        {#if puedeCompartir}
          <button type="button" class="btn-secundario" onclick={compartir}>
            {i18n.t("enviar_asis.compartir")}
          </button>
        {/if}
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
  .enviar-asis-texto {
    white-space: pre-wrap;
    word-break: break-word;
    font: inherit;
    background: var(--c-fondo);
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    padding: 12px;
    margin: 0 0 14px;
    max-height: 40vh;
    overflow-y: auto;
  }
  .enviar-asis-acciones {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .enviar-asis-acciones button {
    width: 100%;
  }
</style>
