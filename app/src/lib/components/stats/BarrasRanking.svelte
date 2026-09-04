<script lang="ts">
  import type { FilaTrabajador } from "@cuadrilla/shared/domain";

  let { filas }: { filas: FilaTrabajador[] } = $props();

  const max = $derived(Math.max(1, ...filas.map((f) => f.unidades)));
</script>

<ul class="ranking">
  {#each filas as f, i (f.workerId)}
    <li>
      <span class="rk-pos">{i + 1}</span>
      <span class="rk-nombre">{f.name}</span>
      <span class="rk-barra">
        <span style={`width:${(f.unidades / max) * 100}%`}></span>
      </span>
      <span class="rk-valor">
        {f.unidades}
        {#if f.unidadesPorHora !== null}
          <small>{f.unidadesPorHora}/h</small>
        {/if}
      </span>
    </li>
  {/each}
</ul>
