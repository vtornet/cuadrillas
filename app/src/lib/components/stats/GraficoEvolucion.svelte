<script lang="ts">
  let { puntos }: { puntos: Array<{ fecha: string; unidades: number }> } =
    $props();

  const W = 320;
  const H = 110;
  const P = 8;

  const max = $derived(Math.max(1, ...puntos.map((p) => p.unidades)));

  const coords = $derived(
    puntos.map((p, i) => {
      const x =
        puntos.length <= 1
          ? W / 2
          : P + (i / (puntos.length - 1)) * (W - 2 * P);
      const y = H - P - (p.unidades / max) * (H - 2 * P);
      return [x, y] as const;
    }),
  );

  const linea = $derived(
    coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" "),
  );
  const area = $derived(
    coords.length > 0
      ? `${linea} L${coords[coords.length - 1][0]},${H - P} L${coords[0][0]},${H - P} Z`
      : "",
  );

  const dia = (f: string): string => f.slice(5).replace("-", "/");
</script>

<div class="evol">
  <svg
    class="evol-svg"
    viewBox={`0 0 ${W} ${H}`}
    preserveAspectRatio="none"
    role="img"
    aria-label="Evolucion diaria de unidades"
  >
    {#if area}<path d={area} class="evol-area" />{/if}
    {#if linea}<path d={linea} class="evol-linea" />{/if}
    {#each coords as [x, y], i (i)}
      <circle cx={x} cy={y} r="2.5" class="evol-punto" />
    {/each}
  </svg>
  {#if puntos.length > 1}
    <div class="evol-fechas">
      <span>{dia(puntos[0].fecha)}</span>
      <span>{dia(puntos[puntos.length - 1].fecha)}</span>
    </div>
  {/if}
</div>
