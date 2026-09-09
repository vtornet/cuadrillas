<script lang="ts">
  import { fechaES } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";

  let {
    fecha,
    finca,
    producto,
    unidad,
    nRecolectores,
    nAuxiliares,
  }: {
    fecha: string;
    finca?: string;
    producto: string;
    unidad: string;
    nRecolectores: number;
    nAuxiliares: number;
  } = $props();

  const titulo = $derived(unidad ? `${producto} · ${unidad}` : producto);

  const meta = $derived(
    [
      finca?.trim() || null,
      fechaES(fecha),
      i18n.t("cabecera.recolectores", { n: nRecolectores }),
      nAuxiliares > 0
        ? i18n.t("cabecera.auxiliares", { n: nAuxiliares })
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  );
</script>

<div class="cab-parte">
  <p class="cab-1">{titulo}</p>
  <p class="cab-2">{meta}</p>
</div>

<style>
  .cab-parte {
    margin: 6px 0 0;
  }
  .cab-1 {
    margin: 0;
    font-weight: 700;
  }
  .cab-2 {
    margin: 2px 0 0;
    color: var(--c-texto-suave);
    font-size: 14px;
  }
</style>
