<script lang="ts">
  import { untrack } from "svelte";
  import type { Idioma, Worker } from "@cuadrilla/shared";
  import { IDIOMAS } from "@cuadrilla/shared";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import { centimosATexto, eurosACentimos } from "../../money";
  import EditSheet from "../EditSheet.svelte";

  let { registro, onclose }: { registro: Worker | null; onclose: () => void } =
    $props();

  const IDIOMA_LABEL: Record<Idioma, string> = {
    es: "Español",
    ro: "Română",
    ar: "العربية",
    fr: "Français",
    en: "English",
  };

  const { reg, ini } = untrack(() => {
    const reg = registro;
    const transporte = reg?.transporteCentimos ?? 0;
    return {
      reg,
      ini: {
        name: reg?.name ?? "",
        alias: reg?.alias ?? "",
        crewId: reg?.crewId ?? gestion.crews[0]?.id ?? "",
        language: (reg?.language ?? "es") as Idioma,
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
  let language = $state<Idioma>(ini.language);
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
      language !== ini.language ||
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

  function construir(): Worker {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      name: name.trim(),
      alias: alias.trim(),
      crewId,
      language,
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
    <span>{i18n.t("worker.idioma")}</span>
    <select bind:value={language}>
      {#each IDIOMAS as id (id)}
        <option value={id}>{IDIOMA_LABEL[id]}</option>
      {/each}
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
</EditSheet>
