<script lang="ts">
  import type { Worker, Crew } from "@cuadrilla/shared";
  import { api } from "../lib/api";
  import { router } from "../lib/router.svelte";

  type Fila = Worker & { cuadrilla: string };

  let crews = $state<Crew[]>([]);
  let filas = $state<Fila[] | null>(null);
  let error = $state<string | null>(null);

  let crewId = $state(router.param ?? "");
  let q = $state("");
  let detalle = $state<(Worker & { cuadrilla: string }) | null>(null);

  async function cargar(): Promise<void> {
    filas = null;
    error = null;
    try {
      filas = await api<Fila[]>("/trabajadores", {
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
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  function eur(centimos?: number): string {
    return centimos ? `${(centimos / 100).toFixed(2)} €` : "—";
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
  <h2>{d.name}</h2>
  <dl class="pares">
    <dt>Alias</dt><dd>{d.alias}</dd>
    <dt>Cuadrilla</dt><dd>{d.cuadrilla}</dd>
    <dt>Idioma</dt><dd>{d.language}</dd>
    <dt>Transporte / día</dt><dd>{eur(d.transporteCentimos)}</dd>
    <dt>DNI / NIE</dt><dd>{d.laboral?.dni ?? "—"}</dd>
    <dt>Nº afiliación SS</dt><dd>{d.laboral?.numAfiliacionSS ?? "—"}</dd>
    <dt>IBAN</dt><dd>{d.laboral?.iban ?? "—"}</dd>
    <dt>Fecha de alta</dt><dd>{d.laboral?.fechaAlta ?? "—"}</dd>
    <dt>Fecha de baja</dt><dd>{d.laboral?.fechaBaja ?? "—"}</dd>
    <dt>Tipo de contrato</dt><dd>{d.laboral?.tipoContrato ?? "—"}</dd>
    <dt>Categoría</dt><dd>{d.laboral?.categoria ?? "—"}</dd>
  </dl>
  <p style="margin-top:12px">
    <button type="button" onclick={() => (detalle = null)}>Cerrar</button>
  </p>
  <p class="et" style="color:var(--suave);font-size:13px">
    La edición de los datos laborales llega en la Fase C.
  </p>
{/if}
