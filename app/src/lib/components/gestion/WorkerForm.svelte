<script lang="ts">
  import { untrack } from "svelte";
  import type { FuncionTrabajador, Worker } from "@cuadrilla/shared";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import { centimosATexto, eurosACentimos } from "../../money";
  import { generarInformeTrabajador } from "../../rgpd";
  import { informeABlob } from "../../export/rgpd";
  import { compartirArchivo, slug } from "../../export/compartir";
  import EditSheet from "../EditSheet.svelte";

  let { registro, onclose }: { registro: Worker | null; onclose: () => void } =
    $props();

  const { reg, ini } = untrack(() => {
    const reg = registro;
    const transporte = reg?.transporteCentimos ?? 0;
    return {
      reg,
      ini: {
        name: reg?.name ?? "",
        alias: reg?.alias ?? "",
        crewId: reg?.crewId ?? gestion.crews[0]?.id ?? "",
        funcion: (reg?.funcion ?? "recolector") as FuncionTrabajador,
        activo: (reg?.activo ?? 1) === 1,
        qrCode: reg?.qrCode ?? "",
        pagaTransporte: transporte > 0,
        transporte: transporte > 0 ? centimosATexto(transporte) : "",
      },
    };
  });

  let name = $state(ini.name);
  let alias = $state(ini.alias);
  let crewId = $state(ini.crewId);
  let funcion = $state<FuncionTrabajador>(ini.funcion);
  let activo = $state(ini.activo);
  let qrCode = $state(ini.qrCode);
  let pagaTransporte = $state(ini.pagaTransporte);
  let transporte = $state(ini.transporte);

  const transporteCentimos = $derived(
    pagaTransporte ? (eurosACentimos(transporte) ?? 0) : 0,
  );

  const dirty = $derived(
    name.trim() !== ini.name ||
      alias.trim() !== ini.alias ||
      crewId !== ini.crewId ||
      funcion !== ini.funcion ||
      activo !== ini.activo ||
      qrCode.trim() !== ini.qrCode ||
      pagaTransporte !== ini.pagaTransporte ||
      (pagaTransporte && transporte.trim() !== ini.transporte),
  );
  const valido = $derived(
    name.trim().length > 0 &&
      alias.trim().length > 0 &&
      !!crewId &&
      (!pagaTransporte || transporteCentimos > 0),
  );

  // --- RGPD ---
  let rgpdEstado = $state<"idle" | "generando" | "ok" | "error">("idle");
  let confirmandoAnon = $state(false);
  let anonimizando = $state(false);

  async function exportarDatos(): Promise<void> {
    if (!reg || rgpdEstado === "generando") return;
    rgpdEstado = "generando";
    try {
      const informe = await generarInformeTrabajador(reg);
      await compartirArchivo(
        informeABlob(informe),
        `datos-${slug(reg.name)}.txt`,
      );
      rgpdEstado = "ok";
    } catch (e) {
      console.error("[rgpd] export", e);
      rgpdEstado = "error";
    }
  }

  async function anonimizar(): Promise<void> {
    if (!reg || anonimizando) return;
    anonimizando = true;
    try {
      await gestion.anonimizarWorker(reg, i18n.t("worker.rgpd_generico"));
      onclose();
    } catch (e) {
      console.error("[rgpd] anonimizar", e);
      anonimizando = false;
    }
  }

  function construir(): Worker {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      name: name.trim(),
      alias: alias.trim(),
      crewId,
      funcion: funcion === "auxiliar" ? "auxiliar" : undefined,
      activo: activo ? 1 : 0,
      qrCode: qrCode.trim() || undefined,
      transporteCentimos,
      updatedAt: Date.now(),
      deleted: 0,
    };
  }
</script>

<EditSheet
  titulo={reg
    ? i18n.t("gestion.editar_trabajador")
    : i18n.t("gestion.nuevo_trabajador")}
  {dirty}
  {valido}
  puedeEliminar={!!reg}
  onguardar={() => gestion.guardar("worker", construir())}
  oneliminar={reg ? () => gestion.eliminar("worker", reg) : undefined}
  {onclose}
>
  <label class="campo">
    <span>{i18n.t("worker.nombre")}</span>
    <input type="text" bind:value={name} autocomplete="off" />
  </label>
  <label class="campo">
    <span>{i18n.t("worker.alias")}</span>
    <input type="text" bind:value={alias} autocomplete="off" />
  </label>
  <label class="campo">
    <span>{i18n.t("jornada.cuadrilla")}</span>
    <select bind:value={crewId}>
      {#each gestion.crews as c (c.id)}
        <option value={c.id}>{c.name}</option>
      {/each}
    </select>
  </label>
  <label class="campo">
    <span>{i18n.t("worker.funcion")}</span>
    <select bind:value={funcion}>
      <option value="recolector">{i18n.t("worker.funcion_recolector")}</option>
      <option value="auxiliar">{i18n.t("worker.funcion_auxiliar")}</option>
    </select>
  </label>
  <label class="campo">
    <span>{i18n.t("gestion.qr")}</span>
    <input type="text" bind:value={qrCode} autocomplete="off" />
  </label>

  <label class="campo campo-check">
    <input type="checkbox" bind:checked={pagaTransporte} />
    <span>{i18n.t("worker.paga_transporte")}</span>
  </label>
  {#if pagaTransporte}
    <label class="campo">
      <span>{i18n.t("worker.transporte_importe")}</span>
      <input
        type="text"
        inputmode="decimal"
        bind:value={transporte}
        placeholder="5,00"
      />
    </label>
  {/if}

  <label class="campo campo-check">
    <input type="checkbox" bind:checked={activo} />
    <span>{i18n.t("worker.activo")}</span>
  </label>

  {#if reg}
    <div class="rgpd-zona">
      <h3>{i18n.t("worker.rgpd_titulo")}</h3>
      <button
        type="button"
        class="btn-secundario btn-ancho"
        disabled={rgpdEstado === "generando"}
        onclick={exportarDatos}
      >
        {rgpdEstado === "generando"
          ? i18n.t("worker.rgpd_generando")
          : i18n.t("worker.rgpd_exportar")}
      </button>
      {#if rgpdEstado === "ok"}
        <p class="rgpd-ok">{i18n.t("worker.rgpd_exportado")}</p>
      {:else if rgpdEstado === "error"}
        <p class="rgpd-error">{i18n.t("worker.rgpd_export_error")}</p>
      {/if}

      {#if confirmandoAnon}
        <p class="rgpd-aviso">{i18n.t("worker.rgpd_anonimizar_aviso")}</p>
        <div class="rgpd-acciones">
          <button
            type="button"
            class="btn-secundario"
            onclick={() => (confirmandoAnon = false)}
          >
            {i18n.t("pad.cancelar")}
          </button>
          <button
            type="button"
            class="btn-deshacer"
            disabled={anonimizando}
            onclick={anonimizar}
          >
            {i18n.t("worker.rgpd_confirmar")}
          </button>
        </div>
      {:else}
        <button
          type="button"
          class="btn-deshacer btn-ancho"
          onclick={() => (confirmandoAnon = true)}
        >
          {i18n.t("worker.rgpd_anonimizar")}
        </button>
      {/if}
    </div>
  {/if}
</EditSheet>
