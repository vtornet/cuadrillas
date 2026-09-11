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
    onclick={() => router.ir("inicio")}
    aria-label={i18n.t("inicio.titulo")}
  >
    <span aria-hidden="true">&#8962;</span>
  </button>
  <img class="appbar-logo" src="/icon-512.png" alt="" aria-hidden="true" />
  <h1>{titulo}</h1>
  <SyncBadge />
</div>
