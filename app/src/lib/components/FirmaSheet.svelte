<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";
  import { perfil } from "../stores/perfil.svelte";

  /**
   * Hoja final al cerrar un parte: aviso de que no se podra seguir
   * registrando + firma opcional (canvas). `onfinalizar` recibe la firma en
   * PNG (data URL) si se ha dibujado algo y se elige firmar, o `undefined`
   * si se finaliza sin firmar, y el nombre de quien cierra (`firmante`).
   */
  let {
    onfinalizar,
    onclose,
  }: {
    onfinalizar: (firma?: string, firmante?: string) => Promise<void>;
    onclose: () => void;
  } = $props();

  let nombreEscrito = $state("");
  const nombrePerfil = $derived(perfil.nombreJefe);
  const firmante = $derived(nombrePerfil || nombreEscrito.trim());

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let dibujando = false;
  let ultimo: { x: number; y: number } | null = null;
  let vacio = $state(true);
  let finalizando = $state(false);

  onMount(() => {
    if (!perfil.org) void perfil.cargar();

    ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx?.scale(dpr, dpr);
    if (ctx) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a1a";
    }
  });

  function posicion(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent): void {
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    dibujando = true;
    ultimo = posicion(e);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dibujando || !ctx || !ultimo) return;
    const p = posicion(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo = p;
    vacio = false;
  }

  function onPointerUp(): void {
    dibujando = false;
    ultimo = null;
  }

  function borrar(): void {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    vacio = true;
  }

  async function finalizar(conFirma: boolean): Promise<void> {
    if (finalizando) return;
    finalizando = true;
    try {
      const firma = conFirma && !vacio ? canvas.toDataURL("image/png") : undefined;
      await onfinalizar(firma, firmante || undefined);
    } finally {
      finalizando = false;
    }
  }
</script>

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={i18n.t("firma.titulo")}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("firma.titulo")}</h2>
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
      <p class="aviso">{i18n.t("jornada.cerrar_confirmar")}</p>
      <p>{i18n.t("firma.ayuda")}</p>

      {#if nombrePerfil}
        <p class="firma-firmante">
          {i18n.t("firma.firmante", { nombre: nombrePerfil })}
        </p>
      {:else}
        <label class="campo">
          <span>{i18n.t("firma.tu_nombre")}</span>
          <input
            type="text"
            autocomplete="name"
            bind:value={nombreEscrito}
            placeholder={i18n.t("firma.tu_nombre")}
          />
        </label>
        <p class="firma-perfil-hint">{i18n.t("firma.guardar_perfil")}</p>
      {/if}

      <canvas
        bind:this={canvas}
        class="firma-canvas"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
      ></canvas>

      <button
        type="button"
        class="btn-secundario btn-ancho"
        disabled={vacio}
        onclick={borrar}
      >
        {i18n.t("firma.borrar")}
      </button>
    </div>

    <div class="hoja-pie firma-pie">
      <button
        type="button"
        class="btn-secundario"
        disabled={finalizando}
        onclick={() => finalizar(false)}
      >
        {i18n.t("firma.finalizar_sin_firma")}
      </button>
      <button
        type="button"
        class="btn-primario"
        disabled={vacio || finalizando}
        onclick={() => finalizar(true)}
      >
        {i18n.t("firma.finalizar_con_firma")}
      </button>
    </div>
  </div>
</div>
