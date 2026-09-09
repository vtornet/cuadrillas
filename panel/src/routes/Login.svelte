<script lang="ts">
  import { untrack } from "svelte";
  import { sesion } from "../lib/sesion.svelte";

  let { error }: { error?: string | null } = $props();

  let email = $state("");
  let enviando = $state(false);
  let enviado = $state(false);
  let enlaceDev = $state<string | null>(null);
  let err = $state<string | null>(untrack(() => error ?? null));

  async function enviar(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim() || enviando) return;
    enviando = true;
    err = null;
    try {
      const r = await sesion.pedirEnlace(email.trim());
      enviado = true;
      enlaceDev = r.enlace ?? null;
    } catch (e2) {
      err = e2 instanceof Error ? e2.message : "Error al enviar el enlace";
    } finally {
      enviando = false;
    }
  }
</script>

<div class="login">
  <div class="caja">
    <h1>Panel de empresa</h1>
    <p>Acceso para gestores. Te enviamos un enlace de un solo uso.</p>

    {#if err}<p class="aviso">{err}</p>{/if}

    {#if enviado}
      <p class="ok">Revisa tu correo y abre el enlace para entrar.</p>
      {#if enlaceDev}
        <p style="font-size:13px;word-break:break-all">
          (dev) <a href={enlaceDev}>{enlaceDev}</a>
        </p>
      {/if}
    {:else}
      <form onsubmit={enviar}>
        <input
          type="email"
          autocomplete="email"
          placeholder="tu@empresa.com"
          bind:value={email}
        />
        <button type="submit" class="primario" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar enlace"}
        </button>
      </form>
    {/if}
  </div>
</div>
