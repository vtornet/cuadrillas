<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "../i18n/i18n.svelte";
  import { perfil, type CamposPerfil } from "../stores/perfil.svelte";

  let cargado = $state(false);
  let guardando = $state(false);
  let guardado = $state(false);

  let ini = $state<CamposPerfil>({
    empresa: "",
    nombre: "",
    telefono: "",
    nif: "",
  });
  let empresa = $state("");
  let nombre = $state("");
  let telefono = $state("");
  let nif = $state("");

  onMount(async () => {
    await perfil.cargar();
    const o = perfil.org;
    ini = {
      empresa: o?.name ?? "",
      nombre: o?.contactName ?? "",
      telefono: o?.contactPhone ?? "",
      nif: o?.taxId ?? "",
    };
    empresa = ini.empresa;
    nombre = ini.nombre;
    telefono = ini.telefono;
    nif = ini.nif;
    cargado = true;
  });

  const dirty = $derived(
    empresa.trim() !== ini.empresa ||
      nombre.trim() !== ini.nombre ||
      telefono.trim() !== ini.telefono ||
      nif.trim() !== ini.nif,
  );

  async function guardar(): Promise<void> {
    if (!dirty || guardando) return;
    guardando = true;
    guardado = false;
    try {
      await perfil.guardar({ empresa, nombre, telefono, nif });
      ini = {
        empresa: empresa.trim(),
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        nif: nif.trim(),
      };
      guardado = true;
    } catch (e) {
      console.error("[perfil] guardar", e);
    } finally {
      guardando = false;
    }
  }
</script>

{#if cargado}
  <label class="campo">
    <span>{i18n.t("perfil.empresa")}</span>
    <input type="text" bind:value={empresa} autocomplete="organization" />
  </label>
  <label class="campo">
    <span>{i18n.t("perfil.nombre")}</span>
    <input type="text" bind:value={nombre} autocomplete="name" />
  </label>
  <label class="campo">
    <span>{i18n.t("perfil.telefono")}</span>
    <input type="tel" bind:value={telefono} autocomplete="tel" inputmode="tel" />
  </label>
  <label class="campo">
    <span>{i18n.t("perfil.nif")}</span>
    <input type="text" bind:value={nif} autocomplete="off" />
  </label>

  {#if guardado && !dirty}
    <p class="perfil-ok">{i18n.t("perfil.guardado")}</p>
  {/if}

  <button
    type="button"
    class="btn-primario btn-ancho"
    disabled={!dirty || guardando}
    onclick={guardar}
  >
    {guardando ? i18n.t("perfil.guardando") : i18n.t("perfil.guardar")}
  </button>
{/if}

<style>
  .perfil-ok {
    margin: 4px 0 0;
    color: var(--c-exito, #1a7f37);
    font-size: 14px;
  }
</style>
