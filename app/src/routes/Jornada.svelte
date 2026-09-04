<script lang="ts">
  import { onMount } from "svelte";
  import type { Crew, Product, Shift, UnitType, Worker } from "@cuadrilla/shared";
  import { i18n } from "../lib/i18n/i18n.svelte";
  import { sesion } from "../lib/stores/sesion.svelte";
  import { router } from "../lib/stores/router.svelte";
  import { jornada } from "../lib/stores/jornada.svelte";
  import { crewsDelForeman } from "../lib/db/repositories/crews";
  import {
    productosActivos,
    todasLasUnidades,
  } from "../lib/db/repositories/products";
  import { trabajadoresDeCuadrilla } from "../lib/db/repositories/workers";
  import { crearShift, jornadasAbiertas } from "../lib/db/repositories/shifts";
  import AppBar from "../lib/components/AppBar.svelte";

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
  let abiertas = $state<Shift[]>([]);
  let cargado = $state(false);

  let crewId = $state("");
  let productId = $state("");
  let unitTypeId = $state("");
  let fecha = $state(hoyISO());
  let horaInicio = $state(horaActual());
  let asistentes = $state<Set<string>>(new Set());

  let abriendo = $state(false);
  let cerrando = $state(false);
  let confirmandoCierre = $state(false);

  const units = $derived(
    allUnits.filter((u) => u.productId === productId || u.productId === null),
  );
  const workersActuales = $derived(workersPorCrew[crewId] ?? []);
  const otrasAbiertas = $derived(
    abiertas.filter((s) => s.id !== jornada.shift?.id),
  );
  const puedeAbrir = $derived(
    !!crewId && !!productId && !!unitTypeId && asistentes.size > 0 && !abriendo,
  );

  onMount(async () => {
    crews = await crewsDelForeman(sesion.userId);
    products = await productosActivos(sesion.organizationId);
    allUnits = await todasLasUnidades(sesion.organizationId);

    const wpc: Record<string, Worker[]> = {};
    for (const c of crews) wpc[c.id] = await trabajadoresDeCuadrilla(c.id);
    workersPorCrew = wpc;
    abiertas = await jornadasAbiertas();

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

  async function abrir(): Promise<void> {
    if (!puedeAbrir) return;
    abriendo = true;
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
      router.ir("registro");
    } finally {
      abriendo = false;
    }
  }

  async function activar(id: string): Promise<void> {
    await jornada.activar(id);
    router.ir("registro");
  }

  async function cerrar(): Promise<void> {
    cerrando = true;
    try {
      await jornada.cerrarActual();
      abiertas = await jornadasAbiertas();
      confirmandoCierre = false;
    } finally {
      cerrando = false;
    }
  }

  function nombreProducto(id: string): string {
    return products.find((p) => p.id === id)?.name ?? "?";
  }
  function nombreUnidad(id: string): string {
    return allUnits.find((u) => u.id === id)?.name ?? "?";
  }
  function nombreCrew(id: string): string {
    return crews.find((c) => c.id === id)?.name ?? "?";
  }
</script>

<div class="pantalla">
  <header class="cabecera">
    <AppBar titulo={i18n.t("jornada.titulo")} />
  </header>

  <div class="pantalla-cuerpo">
    {#if jornada.shift}
      {@const sh = jornada.shift}
      <section class="bloque">
        <h2>{i18n.t("jornada.activa")}</h2>
        <div class="jornada-card">
          <p class="jc-title">
            {jornada.producto?.name ?? nombreProducto(sh.productId)} ·
            {jornada.unidad?.name ?? nombreUnidad(sh.unitTypeId)}
          </p>
          <p class="jc-sub">
            {nombreCrew(sh.crewId)} · {sh.fecha}
            {#if sh.horaInicio}
              · {i18n.t("jornada.desde", { hora: sh.horaInicio })}
            {/if}
          </p>
          <p class="jc-sub">
            {i18n.t("jornada.presentes", { n: jornada.workers.length })} ·
            {i18n.t("jornada.registrado", { n: jornada.total })}
          </p>

          <div class="jc-acciones">
            <button
              type="button"
              class="btn-primario"
              onclick={() => router.ir("registro")}
            >
              {i18n.t("jornada.ir_registrar")}
            </button>

            {#if confirmandoCierre}
              <div class="confirm-inline">
                <span>{i18n.t("jornada.cerrar_confirmar")}</span>
                <div>
                  <button
                    type="button"
                    class="btn-secundario"
                    onclick={() => (confirmandoCierre = false)}
                  >
                    {i18n.t("jornada.seguir_abierta")}
                  </button>
                  <button
                    type="button"
                    class="btn-deshacer"
                    disabled={cerrando}
                    onclick={cerrar}
                  >
                    {i18n.t("jornada.cerrar_si")}
                  </button>
                </div>
              </div>
            {:else}
              <button
                type="button"
                class="btn-deshacer"
                onclick={() => (confirmandoCierre = true)}
              >
                {i18n.t("jornada.cerrar")}
              </button>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    {#if otrasAbiertas.length > 0}
      <section class="bloque">
        <h2>{i18n.t("jornada.otras_abiertas")}</h2>
        {#each otrasAbiertas as s (s.id)}
          <button
            type="button"
            class="jornada-card jc-boton"
            onclick={() => activar(s.id)}
          >
            <p class="jc-title">
              {nombreProducto(s.productId)} · {nombreUnidad(s.unitTypeId)}
            </p>
            <p class="jc-sub">{nombreCrew(s.crewId)} · {s.fecha}</p>
            <span class="jc-cta">{i18n.t("jornada.activar")}</span>
          </button>
        {/each}
      </section>
    {/if}

    <section class="bloque">
      <h2>{i18n.t("jornada.nueva")}</h2>

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

        <button
          type="button"
          class="btn-primario btn-abrir"
          disabled={!puedeAbrir}
          onclick={abrir}
        >
          {i18n.t("jornada.abrir")}
        </button>
      {/if}
    </section>
  </div>
</div>
