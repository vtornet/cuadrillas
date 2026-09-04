<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew, Product, UnitType, Worker } from "@cuadrilla/shared";
  import { i18n } from "../i18n/i18n.svelte";
  import { sesion } from "../stores/sesion.svelte";
  import { jornada } from "../stores/jornada.svelte";
  import { crewsDelForeman } from "../db/repositories/crews";
  import { productosActivos, todasLasUnidades } from "../db/repositories/products";
  import { trabajadoresDeCuadrilla } from "../db/repositories/workers";
  import { crearShift } from "../db/repositories/shifts";

  let { onclose, oncomenzado }: { onclose: () => void; oncomenzado: () => void } =
    $props();

  function hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function horaActual(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  let crews = $state<Crew[]>([]);
  let products = $state<Product[]>([]);
  let allUnits = $state<UnitType[]>([]);
  let workersPorCrew = $state<Record<string, Worker[]>>({});
  let cargado = $state(false);

  let crewId = $state("");
  let productId = $state("");
  let unitTypeId = $state("");
  let fecha = $state(hoyISO());
  let horaInicio = $state(horaActual());
  let asistentes = $state<Set<string>>(new Set());
  let comenzando = $state(false);

  const units = $derived(
    allUnits.filter((u) => u.productId === productId || u.productId === null),
  );
  const workersActuales = $derived(workersPorCrew[crewId] ?? []);
  const puedeComenzar = $derived(
    !!crewId && !!productId && !!unitTypeId && asistentes.size > 0 && !comenzando,
  );

  onMount(async () => {
    crews = await crewsDelForeman(sesion.userId);
    products = await productosActivos(sesion.organizationId);
    allUnits = await todasLasUnidades(sesion.organizationId);

    const wpc: Record<string, Worker[]> = {};
    for (const c of crews) wpc[c.id] = await trabajadoresDeCuadrilla(c.id);
    workersPorCrew = wpc;

    crewId = crews[0]?.id ?? "";
    productId = products[0]?.id ?? "";
    unitTypeId = primeraUnidad();
    marcarTodos();
    cargado = true;
  });

  function primeraUnidad(): string {
    const us = allUnits.filter(
      (u) => u.productId === productId || u.productId === null,
    );
    return us[0]?.id ?? "";
  }

  function marcarTodos(): void {
    asistentes = new Set((workersPorCrew[crewId] ?? []).map((w) => w.id));
  }
  function marcarNinguno(): void {
    asistentes = new Set();
  }
  function toggle(id: string): void {
    const s = new Set(asistentes);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    asistentes = s;
  }

  function alCambiarCuadrilla(): void {
    marcarTodos();
  }
  function alCambiarProducto(): void {
    if (!units.some((u) => u.id === unitTypeId)) unitTypeId = primeraUnidad();
  }

  async function comenzar(): Promise<void> {
    if (!puedeComenzar) return;
    comenzando = true;
    try {
      const shift = await crearShift({
        organizationId: sesion.organizationId,
        crewId,
        productId,
        unitTypeId,
        fecha,
        horaInicio,
        attendeeIds: [...asistentes],
      });
      await jornada.activar(shift.id);
      oncomenzado();
    } finally {
      comenzando = false;
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" role="dialog" aria-modal="true" aria-label={i18n.t("jornada.nueva")}>
  <div class="hoja hoja-worker">
    <div class="hoja-cab">
      <h2>{i18n.t("jornada.nueva")}</h2>
      <button
        type="button"
        class="aspa"
        onclick={onclose}
        aria-label={i18n.t("worker.cerrar")}
      >
        &times;
      </button>
    </div>

    <div class="hoja-cuerpo">
      {#if cargado && crews.length === 0}
        <p class="aviso">{i18n.t("jornada.sin_cuadrillas")}</p>
      {:else if cargado && products.length === 0}
        <p class="aviso">{i18n.t("jornada.sin_productos")}</p>
      {:else}
        <label class="campo">
          <span>{i18n.t("jornada.cuadrilla")}</span>
          <select bind:value={crewId} onchange={alCambiarCuadrilla}>
            {#each crews as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </label>

        <label class="campo">
          <span>{i18n.t("jornada.producto")}</span>
          <select bind:value={productId} onchange={alCambiarProducto}>
            {#each products as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </label>

        <label class="campo">
          <span>{i18n.t("jornada.unidad")}</span>
          <select bind:value={unitTypeId}>
            {#each units as u (u.id)}
              <option value={u.id}>{u.name} ({u.abbr})</option>
            {/each}
          </select>
        </label>

        <div class="campo-fila">
          <label class="campo">
            <span>{i18n.t("jornada.fecha")}</span>
            <input type="date" bind:value={fecha} />
          </label>
          <label class="campo">
            <span>{i18n.t("jornada.hora_inicio")}</span>
            <input type="time" bind:value={horaInicio} />
          </label>
        </div>

        <div class="asistencia-cab">
          <span>
            {i18n.t("jornada.asistencia")} ·
            {i18n.t("jornada.presentes", { n: asistentes.size })}
          </span>
          <span class="asistencia-acc">
            <button type="button" class="mini" onclick={marcarTodos}>
              {i18n.t("jornada.todos")}
            </button>
            <button type="button" class="mini" onclick={marcarNinguno}>
              {i18n.t("jornada.ninguno")}
            </button>
          </span>
        </div>

        <ul class="asistencia">
          {#each workersActuales as w (w.id)}
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={asistentes.has(w.id)}
                  onchange={() => toggle(w.id)}
                />
                <span>{w.name}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="hoja-pie">
      <button
        type="button"
        class="btn-primario"
        disabled={!puedeComenzar}
        onclick={comenzar}
      >
        {i18n.t("jornada.abrir")}
      </button>
    </div>
  </div>
</div>
