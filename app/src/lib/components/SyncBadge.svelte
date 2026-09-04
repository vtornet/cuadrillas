<script lang="ts">
  import { syncStatus } from "../sync/status.svelte";
  import { i18n } from "../i18n/i18n.svelte";

  const texto = $derived(
    syncStatus.sincronizando
      ? i18n.t("sync.sincronizando")
      : syncStatus.online
        ? i18n.t("sync.online")
        : i18n.t("sync.offline"),
  );
</script>

<div
  class="sync-badge"
  class:offline={!syncStatus.online}
  class:activo={syncStatus.sincronizando}
>
  <span class="punto" aria-hidden="true"></span>
  <span>{texto}</span>
  {#if syncStatus.pendientes > 0}
    <span class="pend"
      >&middot; {i18n.t("sync.pendientes", { n: syncStatus.pendientes })}</span
    >
  {/if}
</div>
