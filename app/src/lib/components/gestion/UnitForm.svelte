<script lang="ts">
  import { untrack } from "svelte";
  import type { UnitType } from "@cuadrilla/shared";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import EditSheet from "../EditSheet.svelte";

  let { registro, onclose }: { registro: UnitType | null; onclose: () => void } =
    $props();

  const { reg, ini } = untrack(() => {
    const reg = registro;
    return {
      reg,
      ini: {
        name: reg?.name ?? "",
        abbr: reg?.abbr ?? "",
        productId: reg?.productId ?? null,
      },
    };
  });

  let name = $state(ini.name);
  let abbr = $state(ini.abbr);
  let productId = $state<string>(ini.productId ?? "");

  const dirty = $derived(
    name.trim() !== ini.name ||
      abbr.trim() !== ini.abbr ||
      (productId || null) !== ini.productId,
  );
  const valido = $derived(name.trim().length > 0 && abbr.trim().length > 0);

  function construir(): UnitType {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      name: name.trim(),
      abbr: abbr.trim(),
      productId: productId || null,
      updatedAt: Date.now(),
      deleted: 0,
    };
  }
</script>

<EditSheet
  titulo={reg ? i18n.t("gestion.editar_unidad") : i18n.t("gestion.nueva_unidad")}
  {dirty}
  {valido}
  puedeEliminar={!!reg}
  onguardar={() => gestion.guardar("unitType", construir())}
  oneliminar={reg ? () => gestion.eliminar("unitType", reg) : undefined}
  {onclose}
>
  <label class="campo">
    <span>{i18n.t("gestion.unidad_nombre")}</span>
    <input type="text" bind:value={name} autocomplete="off" />
  </label>
  <label class="campo">
    <span>{i18n.t("gestion.unidad_abrev")}</span>
    <input type="text" bind:value={abbr} autocomplete="off" />
  </label>
  <label class="campo">
    <span>{i18n.t("gestion.unidad_producto")}</span>
    <select bind:value={productId}>
      <option value="">{i18n.t("gestion.global")}</option>
      {#each gestion.products as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>
</EditSheet>
