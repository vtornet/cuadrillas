<script lang="ts">
  import { untrack } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";

  /**
   * Fila de un recolector en modo "por horas": nombre/alias (tap -> ficha,
   * igual que WorkerRow) + un campo de horas inline que guarda al perder el
   * foco (mismo patrón que ObservacionesParte).
   */
  let {
    item,
    horas,
    maxHoras,
    onhoras,
    onabrir,
    soloLectura = false,
  }: {
    item: { name: string; alias: string };
    horas: number | null;
    /** Duración de la jornada (o lo transcurrido si sigue abierta): tope de horas. */
    maxHoras: number;
    onhoras: (horas: number | null) => void;
    onabrir: () => void;
    soloLectura?: boolean;
  } = $props();

  function aTexto(h: number | null): string {
    return h != null ? String(h).replace(".", ",") : "";
  }

  let texto = $state(untrack(() => aTexto(horas)));
  $effect(() => {
    texto = aTexto(horas);
  });

  const valor = $derived.by(() => {
    const t = texto.replace(",", ".").trim();
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  });
  // Pequeño margen para no rechazar por redondeo de coma flotante.
  const superaTope = $derived(valor != null && !Number.isNaN(valor) && valor > maxHoras + 0.01);
  const valido = $derived(!Number.isNaN(valor) && !superaTope);

  function alSalir(): void {
    if (!soloLectura && valido && valor !== horas) onhoras(valor);
  }
</script>

<div class="fila fila-horas">
  <button type="button" class="ident" onclick={onabrir}>
    <span class="nombre">
      {item.name}<span class="chevron" aria-hidden="true">&rsaquo;</span>
    </span>
    <span class="alias">{item.alias}</span>
  </button>

  <label class="horas-campo">
    <input
      type="text"
      inputmode="decimal"
      bind:value={texto}
      onblur={alSalir}
      disabled={soloLectura}
      placeholder="0"
      aria-label={i18n.t("horas.horas_de", { nombre: item.name })}
      title={superaTope ? i18n.t("horas.max_error", { max: maxHoras }) : undefined}
      class:invalido={!valido}
    />
    <span class="horas-unidad">{i18n.t("compartir.horas")}</span>
  </label>
</div>

<style>
  .horas-campo {
    grid-area: conteo;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .horas-campo input {
    width: 3.5ch;
    text-align: center;
    font: inherit;
    font-size: var(--f-conteo);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    padding: 4px 2px;
    border: 2px solid var(--c-borde);
    border-radius: var(--radio);
    background: var(--c-superficie);
  }
  .horas-campo input.invalido {
    border-color: var(--c-peligro);
  }
  .horas-campo input:disabled {
    opacity: 0.7;
  }
  .horas-unidad {
    color: var(--c-texto-suave);
    font-size: 13px;
  }
</style>
