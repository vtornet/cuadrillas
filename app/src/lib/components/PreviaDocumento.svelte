<script lang="ts">
  import { i18n } from "../i18n/i18n.svelte";
  import type { Documento } from "../export/documento";

  let {
    documento,
    generando,
    onpdf,
    onexcel,
    onclose,
  }: {
    documento: Documento;
    /** "pdf" | "xls" mientras se genera ese archivo; null si no. */
    generando: string | null;
    onpdf: () => void;
    onexcel: () => void;
    onclose: () => void;
  } = $props();

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-label={documento.titulo}
>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{documento.titulo}</h2>
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
      <p class="pv-nota">{i18n.t("compartir.previa_nota")}</p>

      <div class="pv-doc">
        <table class="pv-cab">
          <tbody>
            {#each documento.cabecera as c (c.etiqueta)}
              <tr>
                <th>{c.etiqueta}</th>
                <td>{c.valor}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#each documento.tablas as t (t.titulo)}
          <h3 class="pv-tit">{t.titulo}</h3>
          <div class="pv-scroll">
            <table class="pv-tabla">
              <thead>
                <tr>
                  {#each t.columnas as col (col.titulo)}
                    <th style:text-align={col.align}>{col.titulo}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each t.filas as fila, fi (fi)}
                  <tr>
                    {#each t.columnas as col, i (i)}
                      <td style:text-align={col.align}>{fila[i] ?? ""}</td>
                    {/each}
                  </tr>
                {/each}
                {#if t.total}
                  <tr class="pv-total">
                    {#each t.columnas as col, i (i)}
                      <td style:text-align={col.align}>{t.total[i] ?? ""}</td>
                    {/each}
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        {/each}

        {#if documento.observaciones}
          <h3 class="pv-tit">{i18n.t("compartir.observaciones")}</h3>
          <p class="pv-obs">{documento.observaciones}</p>
        {/if}

        {#if documento.firmaPng}
          <h3 class="pv-tit">{i18n.t("firma.titulo")}</h3>
          <img class="pv-firma" src={documento.firmaPng} alt={i18n.t("firma.titulo")} />
          {#if documento.firmante}
            <p class="pv-firmante">{documento.firmante}</p>
          {/if}
        {/if}
      </div>
    </div>

    <div class="hoja-pie pv-acciones">
      <button
        type="button"
        class="btn-secundario"
        disabled={!!generando}
        onclick={onpdf}
      >
        {generando === "pdf" ? i18n.t("compartir.generando") : i18n.t("compartir.pdf")}
      </button>
      <button
        type="button"
        class="btn-secundario"
        disabled={!!generando}
        onclick={onexcel}
      >
        {generando === "xls" ? i18n.t("compartir.generando") : i18n.t("compartir.excel")}
      </button>
      <button type="button" class="btn-primario" onclick={onclose}>
        {i18n.t("worker.cerrar")}
      </button>
    </div>
  </div>
</div>

<style>
  .pv-nota {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--c-texto-suave);
  }
  .pv-doc {
    font-size: 14px;
  }
  .pv-cab {
    border-collapse: collapse;
    width: 100%;
    background: var(--c-fondo);
    border: 1px solid var(--c-borde);
    margin-bottom: 14px;
  }
  .pv-cab th,
  .pv-cab td {
    border: 1px solid var(--c-borde);
    padding: 5px 8px;
    text-align: start;
    vertical-align: top;
  }
  .pv-cab th {
    width: 38%;
    font-weight: 700;
  }
  .pv-tit {
    margin: 14px 0 4px;
    font-size: 14px;
  }
  .pv-scroll {
    overflow-x: auto;
  }
  .pv-tabla {
    border-collapse: collapse;
    width: 100%;
  }
  .pv-tabla th,
  .pv-tabla td {
    border: 1px solid var(--c-borde);
    padding: 5px 8px;
    white-space: nowrap;
  }
  .pv-tabla thead th {
    background: var(--c-fondo);
    font-weight: 700;
  }
  .pv-tabla tr.pv-total td {
    font-weight: 700;
    border-top: 2px solid var(--c-borde-fuerte, #999);
  }
  .pv-obs {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid var(--c-borde);
    padding: 8px;
    background: var(--c-fondo);
  }
  .pv-firma {
    max-width: 220px;
    border: 1px solid var(--c-borde);
  }
  .pv-firmante {
    margin: 4px 0 0;
  }
  .pv-acciones {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pv-acciones .btn-primario {
    grid-column: 1 / -1;
  }
</style>
