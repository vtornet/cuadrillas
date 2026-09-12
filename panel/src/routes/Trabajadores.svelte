<script lang="ts">
  import type { Worker, Crew } from "@cuadrilla/shared";
  import { api, get } from "../lib/api";
  import { router } from "../lib/router.svelte";
  import { descargar, slug } from "../lib/export/descargar";
  import { tablaACsv, tablaAXlsx, type Tabla } from "../lib/export/tabla";
  import FichaLaboral from "../lib/FichaLaboral.svelte";

  type Fila = Worker & { cuadrilla: string };

  let crews = $state<Crew[]>([]);
  let filas = $state<Fila[] | null>(null);
  let error = $state<string | null>(null);

  let crewId = $state(router.param ?? "");
  let q = $state("");
  let detalle = $state<(Worker & { cuadrilla: string }) | null>(null);
  let cambiandoCuadrilla = $state(false);
  let crewSel = $state("");

  async function cargar(): Promise<void> {
    filas = null;
    error = null;
    try {
      filas = await get<Fila[]>("/trabajadores", {
        crewId: crewId || undefined,
        q: q.trim() || undefined,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  $effect(() => {
    if (crews.length === 0) {
      api<Crew[]>("/cuadrillas").then((c) => (crews = c)).catch(() => {});
    }
  });

  // Recarga al cambiar filtros (con un pequeño rebote para el texto).
  let t: ReturnType<typeof setTimeout>;
  $effect(() => {
    crewId;
    q;
    clearTimeout(t);
    t = setTimeout(cargar, 200);
  });

  async function abrir(id: string): Promise<void> {
    try {
      detalle = await api<Worker & { cuadrilla: string }>(
        `/trabajadores/${id}`,
      );
      cambiandoCuadrilla = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  function eur(centimos?: number): string {
    return centimos ? `${(centimos / 100).toFixed(2)} €` : "—";
  }

  function abrirCambioCuadrilla(): void {
    if (!detalle) return;
    crewSel = detalle.crewId;
    cambiandoCuadrilla = true;
  }

  async function guardarCuadrilla(): Promise<void> {
    if (!detalle || !crewSel) return;
    try {
      detalle = await api<Worker & { cuadrilla: string }>(
        `/trabajadores/${detalle.id}/cuadrilla`,
        { metodo: "PUT", body: { crewId: crewSel } },
      );
      cambiandoCuadrilla = false;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  let generando = $state<string | null>(null);
  function tablaExport(): Tabla {
    const cuad = crews.find((c) => c.id === crewId)?.name ?? "Todas las cuadrillas";
    return {
      titulo: "Trabajadores",
      meta: [
        `Cuadrilla: ${cuad}`,
        ...(q.trim() ? [`Búsqueda: "${q.trim()}"`] : []),
      ],
      cabeceras: ["Nombre", "Alias", "Cuadrilla", "Función", "Alta laboral", "Activo"],
      filas: (filas ?? []).map((w) => [
        w.name,
        w.alias,
        w.cuadrilla,
        w.funcion === "auxiliar" ? "Auxiliar" : "Recolector",
        w.laboral?.fechaAlta ?? "",
        w.activo === 1 ? "Sí" : "No",
      ]),
    };
  }

  async function exportar(fmt: "csv" | "xlsx"): Promise<void> {
    if (!filas || generando) return;
    generando = fmt;
    try {
      const t = tablaExport();
      const blob = fmt === "csv" ? tablaACsv(t) : await tablaAXlsx(t);
      descargar(blob, `trabajadores_${slug(new Date().toISOString().slice(0, 10))}.${fmt}`);
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al exportar";
    } finally {
      generando = null;
    }
  }
</script>

<h1>Trabajadores</h1>

<div class="filtros">
  <select bind:value={crewId}>
    <option value="">Todas las cuadrillas</option>
    {#each crews as c (c.id)}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
  <input type="search" placeholder="Buscar por nombre o alias" bind:value={q} />
</div>

{#if filas && filas.length > 0}
  <p style="display:flex;gap:8px">
    <button type="button" disabled={!!generando} onclick={() => exportar("xlsx")}>
      {generando === "xlsx" ? "…" : "Excel"}
    </button>
    <button type="button" disabled={!!generando} onclick={() => exportar("csv")}>
      {generando === "csv" ? "…" : "CSV"}
    </button>
  </p>
{/if}

{#if error}
  <p class="aviso">{error}</p>
{:else if !filas}
  <p class="cargando">Cargando…</p>
{:else if filas.length === 0}
  <p class="vacio">Sin resultados.</p>
{:else}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Alias</th>
          <th>Cuadrilla</th>
          <th>Función</th>
          <th>Alta laboral</th>
          <th>Activo</th>
        </tr>
      </thead>
      <tbody>
        {#each filas as w (w.id)}
          <tr class="clic" onclick={() => abrir(w.id)}>
            <td>{w.name}</td>
            <td>{w.alias}</td>
            <td>{w.cuadrilla}</td>
            <td>{w.funcion === "auxiliar" ? "Auxiliar" : "Recolector"}</td>
            <td>{w.laboral?.fechaAlta ?? "—"}</td>
            <td>{w.activo === 1 ? "Sí" : "No"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if detalle}
  {@const d = detalle}
  <h2>{d.name} <em style="color:var(--suave)">{d.alias}</em></h2>
  <dl class="pares">
    <dt>Cuadrilla</dt>
    <dd>
      {#if cambiandoCuadrilla}
        <select bind:value={crewSel}>
          {#each crews as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
        <button type="button" class="primario" onclick={guardarCuadrilla}>
          Guardar
        </button>
        <button type="button" onclick={() => (cambiandoCuadrilla = false)}>
          Cancelar
        </button>
      {:else}
        {d.cuadrilla}
        <button type="button" onclick={abrirCambioCuadrilla}>Cambiar</button>
      {/if}
    </dd>
    <dt>Función</dt>
    <dd>{d.funcion === "auxiliar" ? "Auxiliar" : "Recolector"}</dd>
    <dt>Transporte / día</dt><dd>{eur(d.transporteCentimos)}</dd>
  </dl>

  <h3 style="margin:18px 0 8px">Datos laborales</h3>
  {#key d.id}
    <FichaLaboral
      worker={d}
      onguardado={(w) => {
        detalle = w;
        cargar();
      }}
    />
  {/key}

  <p style="margin-top:14px">
    <button type="button" onclick={() => (detalle = null)}>Cerrar ficha</button>
  </p>
{/if}
