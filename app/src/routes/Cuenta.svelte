<script lang="ts">
  import { onMount } from "svelte";
  import type { Organization, Plan } from "@cuadrilla/shared";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { auth } from "../lib/auth/auth.svelte";
  import { syncStatus } from "../lib/sync/status.svelte";
  import { router } from "../lib/stores/router.svelte";
  import { HAY_BACKEND } from "../lib/config";
  import { obtenerOrganizacion } from "../lib/db/repositories/organizations";
  import { irACheckout, irAPortal, type PlanPago } from "../lib/billing";
  import AppBar from "../lib/components/AppBar.svelte";
  import PerfilForm from "../lib/components/PerfilForm.svelte";
  import SelectorIdioma from "../lib/components/SelectorIdioma.svelte";

  // --- Login (estado anonimo) ---
  let email = $state("");
  let enviando = $state(false);
  let enviado = $state(false);
  let enlaceDev = $state<string | null>(null);
  let errorLogin = $state("");

  const emailValido = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()));

  // --- Plan ---
  let org = $state<Organization | null>(null);
  let planCargando = $state(false);
  let planError = $state("");

  const PLANES: Array<{ id: PlanPago; titulo: string; desc: string }> = [
    { id: "foreman", titulo: i18n.t("plan.foreman"), desc: i18n.t("plan.foreman_desc") },
    { id: "company", titulo: i18n.t("plan.company"), desc: i18n.t("plan.company_desc") },
    { id: "campaign", titulo: i18n.t("plan.campaign"), desc: i18n.t("plan.campaign_desc") },
  ];

  const esDePago = $derived(!!org && org.plan !== "free");
  /** Planes de pago que no son el actual — para ofrecer cambiar a ellos. */
  const otrosPlanes = $derived(PLANES.filter((p) => !org || org.plan !== p.id));
  let cambioMsg = $state("");
  const checkoutMsg = $derived(
    typeof window !== "undefined" && window.location.hash.includes("checkout=success")
      ? i18n.t("plan.pago_recibido")
      : typeof window !== "undefined" && window.location.hash.includes("checkout=cancel")
        ? i18n.t("plan.pago_cancelado")
        : "",
  );

  onMount(cargarOrg);

  async function cargarOrg(): Promise<void> {
    if (!HAY_BACKEND || !auth.autenticado) return;
    org = (await obtenerOrganizacion(auth.organizationId)) ?? null;
  }

  $effect(() => {
    // Al terminar una sincronizacion, relee el plan.
    syncStatus.ultimoSync;
    void cargarOrg();
  });

  async function contratar(plan: PlanPago): Promise<void> {
    if (planCargando) return;
    planCargando = true;
    planError = "";
    cambioMsg = "";
    try {
      const r = await irACheckout(plan);
      if (r.actualizado) {
        // Ya había una suscripción activa: Stripe la actualizó in situ, sin
        // checkout nuevo — no hay a dónde navegar, solo refrescar el plan.
        cambioMsg = i18n.t("plan.cambiado", { plan: nombrePlan(plan) });
        await cargarOrg();
        planCargando = false;
      }
      // si no, ya se ha navegado a Stripe Checkout.
    } catch (e) {
      planError =
        (e as Error).message === "no-configurado"
          ? i18n.t("plan.no_configurado")
          : i18n.t("plan.error");
      planCargando = false;
    }
  }

  async function gestionar(): Promise<void> {
    if (planCargando) return;
    planCargando = true;
    planError = "";
    try {
      await irAPortal();
    } catch {
      planError = i18n.t("plan.error");
      planCargando = false;
    }
  }

  async function enviar(): Promise<void> {
    if (!emailValido || enviando) return;
    enviando = true;
    errorLogin = "";
    try {
      const r = await auth.pedirEnlace(email.trim());
      enviado = true;
      enlaceDev = r.enlace ?? null;
    } catch {
      errorLogin = i18n.t("cuenta.error_envio");
    } finally {
      enviando = false;
    }
  }

  function nombrePlan(p: Plan): string {
    return i18n.t(`plan.${p}`);
  }

  function fecha(ts: number | null): string {
    return ts
      ? new Date(ts).toLocaleString(i18n.locale, {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  }
</script>

{#if auth.estado === "anonimo"}
  <div class="pantalla">
    <header class="cabecera"><AppBar titulo={i18n.t("app.nombre")} /></header>
    <div class="pantalla-cuerpo login">
      <img class="login-logo" src="/logo.png" alt={i18n.t("app.nombre")} />
      <h2>{i18n.t("cuenta.entrar")}</h2>
      <p class="login-ayuda">{i18n.t("cuenta.ayuda")}</p>

      {#if enviado}
        <p class="login-ok">{i18n.t("cuenta.revisa_correo", { email: email.trim() })}</p>
        {#if enlaceDev}
          <p class="login-dev">
            {i18n.t("cuenta.enlace_dev")}<br />
            <a href={enlaceDev}>{enlaceDev}</a>
          </p>
        {/if}
        <button type="button" class="btn-secundario" onclick={() => (enviado = false)}>
          {i18n.t("cuenta.otro_email")}
        </button>
      {:else}
        <label class="campo">
          <span>{i18n.t("cuenta.email")}</span>
          <input
            type="email"
            inputmode="email"
            autocomplete="email"
            bind:value={email}
            placeholder="tu@correo.com"
          />
        </label>
        {#if errorLogin}<p class="login-error">{errorLogin}</p>{/if}
        <button
          type="button"
          class="btn-primario btn-abrir"
          disabled={!emailValido || enviando}
          onclick={enviar}
        >
          {i18n.t("cuenta.enviar_enlace")}
        </button>
      {/if}

      <button type="button" class="btn-secundario login-demo" onclick={() => auth.entrarModoDemo()}>
        {i18n.t("cuenta.modo_demo")}
      </button>

      <SelectorIdioma compacto />

      <button type="button" class="link-privacidad" onclick={() => router.ir("privacidad")}>
        {i18n.t("privacidad.enlace")}
      </button>
    </div>
  </div>
{:else}
  <div class="pantalla">
    <header class="cabecera"><AppBar titulo={i18n.t("cuenta.titulo")} /></header>
    <div class="pantalla-cuerpo">
      <section class="bloque">
        <h2>{i18n.t("cuenta.sesion")}</h2>
        <div class="jornada-card">
          {#if auth.estado === "demo"}
            <p class="jc-title">{i18n.t("cuenta.modo_demo_activo")}</p>
            <p class="jc-sub">{i18n.t("cuenta.demo_sub")}</p>
          {:else}
            <p class="jc-title">{auth.email}</p>
            <p class="jc-sub">
              {org ? nombrePlan(org.plan) : i18n.t("cuenta.plan_gratis")}
            </p>
          {/if}
        </div>
      </section>

      <section class="bloque">
        <h2>{i18n.t("perfil.titulo")}</h2>
        <SelectorIdioma />
        <PerfilForm />
        <button
          type="button"
          class="link-privacidad"
          onclick={() => router.ir("privacidad")}
        >
          {i18n.t("privacidad.enlace")}
        </button>
      </section>

      {#if HAY_BACKEND && auth.estado === "autenticado"}
        <section class="bloque">
          <h2>{i18n.t("plan.titulo")}</h2>

          {#if checkoutMsg}<p class="login-ok">{checkoutMsg}</p>{/if}
          {#if cambioMsg}<p class="login-ok">{cambioMsg}</p>{/if}
          {#if planError}<p class="login-error">{planError}</p>{/if}

          {#if esDePago && org}
            <div class="jornada-card">
              <p class="jc-title">{nombrePlan(org.plan)}</p>
              {#if org.subscriptionStatus}
                <p class="jc-sub">
                  {i18n.t("plan.estado")}: {org.subscriptionStatus}
                </p>
              {/if}
              <p class="jc-sub">
                {i18n.t("plan.limites", {
                  crews: org.planLimits.crews,
                  workers: org.planLimits.workers,
                })}
              </p>
              <div class="jc-acciones">
                <button
                  type="button"
                  class="btn-primario"
                  disabled={planCargando}
                  onclick={gestionar}
                >
                  {i18n.t("plan.gestionar")}
                </button>
              </div>
            </div>
          {:else}
            <p class="jc-sub" style="margin-bottom:10px">{i18n.t("plan.gratis_actual")}</p>
          {/if}

          {#if otrosPlanes.length > 0}
            <p class="plan-otros-titulo">
              {esDePago ? i18n.t("plan.cambiar_titulo") : i18n.t("plan.elegir_titulo")}
            </p>
            {#each otrosPlanes as p (p.id)}
              <div class="plan-card">
                <div>
                  <p class="pc-titulo">{p.titulo}</p>
                  <p class="pc-desc">{p.desc}</p>
                </div>
                <button
                  type="button"
                  class="btn-primario"
                  disabled={planCargando}
                  onclick={() => contratar(p.id)}
                >
                  {p.id === "campaign"
                    ? i18n.t("plan.pagar")
                    : esDePago
                      ? i18n.t("plan.cambiar")
                      : i18n.t("plan.suscribirse")}
                </button>
              </div>
            {/each}
          {/if}
        </section>

        <section class="bloque">
          <h2>{i18n.t("cuenta.sincronizacion")}</h2>
          <div class="jornada-card">
            <p class="jc-sub">
              {syncStatus.online ? i18n.t("sync.online") : i18n.t("sync.offline")}
              &middot; {i18n.t("cuenta.pendientes", { n: syncStatus.pendientes })}
            </p>
            <p class="jc-sub">
              {i18n.t("cuenta.ultimo_sync")}: {fecha(syncStatus.ultimoSync)}
            </p>
            {#if syncStatus.rechazos.length > 0}
              <p class="login-error">
                {i18n.t("cuenta.rechazos", { n: syncStatus.rechazos.length })}
              </p>
              <button type="button" class="mini" onclick={() => syncStatus.descartarRechazos()}>
                {i18n.t("cuenta.descartar")}
              </button>
            {/if}
            <div class="jc-acciones">
              <button
                type="button"
                class="btn-primario"
                disabled={syncStatus.sincronizando || !syncStatus.online}
                onclick={() => syncStatus.sincronizarAhora()}
              >
                {syncStatus.sincronizando
                  ? i18n.t("cuenta.sincronizando")
                  : i18n.t("cuenta.sincronizar_ahora")}
              </button>
            </div>
          </div>
        </section>
      {/if}

      <section class="bloque">
        <button type="button" class="btn-deshacer" style="width:100%" onclick={() => auth.salir()}>
          {auth.estado === "demo" ? i18n.t("cuenta.salir_demo") : i18n.t("cuenta.cerrar_sesion")}
        </button>
      </section>
    </div>
  </div>
{/if}
