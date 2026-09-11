<script lang="ts">
  import { fechaES } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";

  let {
    fecha,
    finca,
    producto,
    unidad,
    horaInicio,
    horaFin,
    nRecolectores,
    nAuxiliares,
    porHoras = false,
  }: {
    fecha: string;
    finca?: string;
    producto: string;
    unidad: string;
    horaInicio?: string | null;
    horaFin?: string | null;
    nRecolectores: number;
    nAuxiliares: number;
    /** Parte "por horas" (sin conteo individual de unidades). */
    porHoras?: boolean;
  } = $props();

  const titulo = $derived(unidad ? `${producto} · ${unidad}` : producto);

  /** "08:00 – 14:30" · "08:00 – …" (parte abierto) · null si no hay inicio. */
  const horario = $derived(
    horaInicio ? `${horaInicio} – ${horaFin || "…"}` : null,
  );

  const meta = $derived(
    [
      finca?.trim() || null,
      fechaES(fecha),
      horario,
      i18n.t("cabecera.recolectores", { n: nRecolectores }),
      nAuxiliares > 0
        ? i18n.t("cabecera.auxiliares", { n: nAuxiliares })
        : null,
      porHoras ? i18n.t("cabecera.por_horas") : null,
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
