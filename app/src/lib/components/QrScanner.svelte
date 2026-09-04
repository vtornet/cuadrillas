<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";

  let {
    ondetect,
    onclose,
  }: {
    ondetect: (texto: string) => void;
    onclose: () => void;
  } = $props();

  let video = $state<HTMLVideoElement>();
  let stream: MediaStream | null = null;
  let raf = 0;
  let soportado = $state(true);
  let error = $state("");

  onMount(async () => {
    // BarcodeDetector: disponible en Chrome/Android. Fallback con @zxing/browser
    // pendiente (paso posterior); de momento se cae con elegancia a la busqueda.
    const Detector = (globalThis as Record<string, unknown>).BarcodeDetector as
      | (new (opts: { formats: string[] }) => {
          detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
        })
      | undefined;

    if (!Detector) {
      soportado = false;
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async (): Promise<void> => {
        if (!video) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            ondetect(codes[0].rawValue);
            return;
          }
        } catch {
          // fotograma no valido, se ignora
        }
        raf = requestAnimationFrame(() => void tick());
      };
      raf = requestAnimationFrame(() => void tick());
    } catch (e) {
      error = i18n.t("qr.sin_camara");
      console.error("[qr]", e);
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
  });
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={i18n.t("registro.escanear")}>
  <div class="hoja">
    {#if !soportado}
      <p class="scanner-texto">{i18n.t("qr.no_disponible")}</p>
    {:else if error}
      <p class="scanner-texto">{error}</p>
    {:else}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video class="scanner-video" bind:this={video} playsinline></video>
      <p class="scanner-texto">{i18n.t("qr.apunta")}</p>
    {/if}
    <button type="button" class="btn-secundario" style="width:100%" onclick={onclose}>
      {i18n.t("qr.cerrar")}
    </button>
  </div>
</div>
