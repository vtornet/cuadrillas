<script lang="ts">
  import { onMount } from "svelte";
  import Registro from "./routes/Registro.svelte";
  import Historial from "./routes/Historial.svelte";
  import Estadisticas from "./routes/Estadisticas.svelte";
  import Asistencia from "./routes/Asistencia.svelte";
  import Gestion from "./routes/Gestion.svelte";
  import Cuenta from "./routes/Cuenta.svelte";
  import Privacidad from "./routes/Privacidad.svelte";
  import MenuSheet from "./lib/components/MenuSheet.svelte";
  import { i18n } from "./lib/i18n/i18n.svelte";
  import { router } from "./lib/stores/router.svelte";
  import { auth } from "./lib/auth/auth.svelte";
  import { jornada } from "./lib/stores/jornada.svelte";
  import { syncStatus } from "./lib/sync/status.svelte";
  import { seedDemo } from "./lib/dev/seed";

  let listo = $state(false);

  onMount(async () => {
    await auth.cargar();

    // Retorno del enlace magico: #/entrar?token=XXX
    const m = window.location.hash.match(/entrar\?token=([^&]+)/);
    if (m) {
      try {
        await auth.verificar(decodeURIComponent(m[1]));
      } catch (e) {
        console.error("[auth] verificar", e);
      }
      window.location.hash = "#/cuenta";
    }

    if (auth.estado === "demo") await seedDemo();

    await jornada.cargar();
    await syncStatus.refrescarPendientes();
    syncStatus.arrancar();
    listo = true;

    // Vuelta de Stripe Checkout: sincroniza para recibir el plan actualizado.
    if (window.location.hash.includes("checkout=success")) {
      void syncStatus.sincronizarAhora();
    }
  });
</script>

{#if !listo}
  <p class="cargando">{i18n.t("app.cargando")}</p>
{:else if auth.estado === "anonimo"}
  {#if router.vista === "privacidad"}
    <Privacidad />
  {:else}
    <Cuenta />
  {/if}
{:else}
  <main>
    {#if router.vista === "historial"}
      <Historial />
    {:else if router.vista === "estadisticas"}
      <Estadisticas />
    {:else if router.vista === "asistencia"}
      <Asistencia />
    {:else if router.vista === "gestion"}
      <Gestion />
    {:else if router.vista === "cuenta"}
      <Cuenta />
    {:else if router.vista === "privacidad"}
      <Privacidad />
    {:else}
      <Registro />
    {/if}
  </main>
  {#if router.menuAbierto}
    <MenuSheet onclose={() => router.cerrarMenu()} />
  {/if}
{/if}
