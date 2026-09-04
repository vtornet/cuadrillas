<script lang="ts">
  import { untrack } from "svelte";
  import type { Rate } from "@cuadrilla/shared";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import { centimosATexto, eurosACentimos } from "../../money";
  import EditSheet from "../EditSheet.svelte";

  let { registro, onclose }: { registro: Rate | null; onclose: () => void } =
    $props();

  function hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  const { reg, ini } = untrack(() => {
    const reg = registro;
    const productId = reg?.productId ?? gestion.products[0]?.id ?? "";
    const unitTypeId =
      reg?.unitTypeId ??
      gestion.units.find(
        (u) => u.productId === productId || u.productId === null,
      )?.id ??
      "";
    return {
      reg,
      ini: {
        productId,
        unitTypeId,
        importe: reg ? centimosATexto(reg.amountPerUnit) : "",
        validFrom: reg?.validFrom ?? hoyISO(),
        validTo: reg?.validTo ?? null,
      },
    };
  });

  let productId = $state(ini.productId);
  let unitTypeId = $state(ini.unitTypeId);
  let importe = $state(ini.importe);
  let validFrom = $state(ini.validFrom);
  let sinFin = $state(ini.validTo === null);
  let validTo = $state(ini.validTo ?? hoyISO());

  const unidades = $derived(
    gestion.units.filter(
      (u) => u.productId === productId || u.productId === null,
    ),
  );
  const centimos = $derived(eurosACentimos(importe));
  const validToFinal = $derived(sinFin ? null : validTo);

  const dirty = $derived(
    productId !== ini.productId ||
      unitTypeId !== ini.unitTypeId ||
      importe.trim() !== ini.importe ||
      validFrom !== ini.validFrom ||
      validToFinal !== ini.validTo,
  );
  const valido = $derived(
    !!productId &&
      !!unitTypeId &&
      centimos !== null &&
      centimos > 0 &&
      !!validFrom &&
      (sinFin || validTo >= validFrom),
  );

  function alCambiarProducto(): void {
    if (!unidades.some((u) => u.id === unitTypeId)) {
      unitTypeId = unidades[0]?.id ?? "";
    }
  }

  function construir(): Rate {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      productId,
      unitTypeId,
      amountPerUnit: centimos ?? 0,
      validFrom,
      validTo: validToFinal,
      updatedAt: Date.now(),
      deleted: 0,
    };
  }
</script>

<EditSheet
  titulo={reg ? i18n.t("gestion.editar_tarifa") : i18n.t("gestion.nueva_tarifa")}
  {dirty}
  {valido}
  puedeEliminar={!!reg}
  onguardar={() => gestion.guardar("rate", construir())}
  oneliminar={reg ? () => gestion.eliminar("rate", reg) : undefined}
  {onclose}
>
  <label class="campo">
    <span>{i18n.t("jornada.producto")}</span>
    <select bind:value={productId} onchange={alCambiarProducto}>
      {#each gestion.products as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>
  <label class="campo">
    <span>{i18n.t("jornada.unidad")}</span>
    <select bind:value={unitTypeId}>
      {#each unidades as u (u.id)}
        <option value={u.id}>{u.name} ({u.abbr})</option>
      {/each}
    </select>
  </label>
  <label class="campo">
    <span>{i18n.t("gestion.tarifa_importe")}</span>
    <input type="text" inputmode="decimal" bind:value={importe} placeholder="0,18" />
  </label>
  <label class="campo">
    <span>{i18n.t("gestion.tarifa_desde")}</span>
    <input type="date" bind:value={validFrom} />
  </label>
  <label class="campo campo-check">
    <input type="checkbox" bind:checked={sinFin} />
    <span>{i18n.t("gestion.tarifa_sin_fin")}</span>
  </label>
  {#if !sinFin}
    <label class="campo">
      <span>{i18n.t("gestion.tarifa_hasta")}</span>
      <input type="date" bind:value={validTo} min={validFrom} />
    </label>
  {/if}
</EditSheet>
