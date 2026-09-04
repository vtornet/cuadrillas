<script lang="ts">
  import SyncBadge from "./SyncBadge.svelte";
  import { i18n } from "../i18n/i18n.svelte";
  import { router } from "../stores/router.svelte";

  let { titulo }: { titulo: string } = $props();
</script>

<div class="appbar">
  <button
    type="button"
    class="appbar-menu"
    onclick={() => router.abrirMenu()}
    aria-label={i18n.t("menu.titulo")}
  >
    <span aria-hidden="true">&#9776;</span>
  </button>
  <h1>{titulo}</h1>
  <SyncBadge />
</div>
