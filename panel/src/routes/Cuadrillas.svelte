<script lang="ts">
  import type { Crew } from "@cuadrilla/shared";
  import { api, get } from "../lib/api";

  type Fila = Crew & { numTrabajadores: number };

  let filas = $state<Fila[] | null>(null);
  let error = $state<string | null>(null);

  let nueva = $state("");
  let creando = $state(false);
  let editId = $state<string | null>(null);
  let editName = $state("");
  let borrarId = $state<string | null>(null);

  async function cargar(): Promise<void> {
    error = null;
    try {
      filas = await get<Fila[]>("/cuadrillas");
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }
  $effect(() => {
    if (!filas) cargar();
  });

  async function crear(): Promise<void> {
    if (!nueva.trim() || creando) return;
    creando = true;
    error = null;
    try {
      await api("/cuadrillas", { metodo: "POST", body: { name: nueva.trim() } });
      nueva = "";
      filas = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al crear";
    } finally {
      creando = false;
    }
  }

  async function renombrar(id: string): Promise<void> {
    if (!editName.trim()) return;
    try {
      await api(`/cuadrillas/${id}`, {
        metodo: "PUT",
        body: { name: editName.trim() },
      });
      editId = null;
      filas = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }

  async function borrar(id: string): Promise<void> {
    try {
      await api(`/cuadrillas/${id}`, { metodo: "DELETE" });
      borrarId = null;
      filas = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al borrar";
    }
  }
</script>

<h1>Cuadrillas</h1>
<p style="color:var(--suave)">
  La empresa define las cuadrillas y sus trabajadores se asignan desde la app de
  campo. Para eliminar una cuadrilla no puede tener trabajadores.
</p>

{#if error}<p class="aviso">{error}</p>{/if}

<div class="filtros">
  <input
    type="text"
    placeholder="Nombre de la nueva cuadrilla"
    bind:value={nueva}
    onkeydown={(e) => e.key === "Enter" && crear()}
  />
  <button type="button" class="primario" disabled={creando} onclick={crear}>
    {creando ? "…" : "Crear cuadrilla"}
  </button>
</div>

{#if !filas}
  <p class="cargando">Cargando…</p>
{:else if filas.length === 0}
  <p class="vacio">Todavía no hay cuadrillas.</p>
{:else}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr><th>Cuadrilla</th><th>Trabajadores</th><th></th></tr>
      </thead>
      <tbody>
        {#each filas as c (c.id)}
          <tr>
            <td>
              {#if editId === c.id}
                <input
                  type="text"
                  bind:value={editName}
                  onkeydown={(e) => e.key === "Enter" && renombrar(c.id)}
                />
              {:else}
                {c.name}
              {/if}
            </td>
            <td>{c.numTrabajadores}</td>
            <td style="white-space:nowrap">
              {#if editId === c.id}
                <button type="button" class="primario" onclick={() => renombrar(c.id)}>
                  Guardar
                </button>
                <button type="button" onclick={() => (editId = null)}>Cancelar</button>
              {:else if borrarId === c.id}
                <button type="button" class="aviso" onclick={() => borrar(c.id)}>
                  Confirmar borrado
                </button>
                <button type="button" onclick={() => (borrarId = null)}>No</button>
              {:else}
                <button
                  type="button"
                  onclick={() => {
                    editId = c.id;
                    editName = c.name;
                  }}
                >
                  Renombrar
                </button>
                <button
                  type="button"
                  disabled={c.numTrabajadores > 0}
                  onclick={() => (borrarId = c.id)}
                >
                  Borrar
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
