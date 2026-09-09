<script lang="ts">
  import { untrack } from "svelte";
  import type { Finca } from "@cuadrilla/shared";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import EditSheet from "../EditSheet.svelte";

  let { registro, onclose }: { registro: Finca | null; onclose: () => void } =
    $props();

  const { reg, ini } = untrack(() => {
    const reg = registro;
    return {
      reg,
      ini: {
        name: reg?.name ?? "",
        activo: (reg?.activo ?? 1) === 1,
      },
    };
  });

  let name = $state(ini.name);
  let activo = $state(ini.activo);

  const dirty = $derived(name.trim() !== ini.name || activo !== ini.activo);
  const valido = $derived(name.trim().length > 0);

  function construir(): Finca {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      name: name.trim(),
      activo: activo ? 1 : 0,
      updatedAt: Date.now(),
      deleted: 0,
    };
  }
</script>

<EditSheet
  titulo={reg ? i18n.t("gestion.editar_finca") : i18n.t("gestion.nueva_finca")}
  {dirty}
  {valido}
  puedeEliminar={!!reg}
  onguardar={() => gestion.guardar("finca", construir())}
  oneliminar={reg ? () => gestion.eliminar("finca", reg) : undefined}
  {onclose}
>
  <label class="campo">
    <span>{i18n.t("gestion.finca_nombre")}</span>
    <input type="text" bind:value={name} autocomplete="off" />
  </label>
  <label class="campo campo-check">
    <input type="checkbox" bind:checked={activo} />
    <span>{i18n.t("gestion.finca_activa")}</span>
  </label>
</EditSheet>
