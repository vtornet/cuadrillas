<script lang="ts">
  import type { Rate, Product, UnitType } from "@cuadrilla/shared";
  import { api, get } from "../lib/api";
  import { eur, centimosATexto, eurosACentimos } from "../lib/money";

  type Fila = Rate & { producto: string; unidad: string };

  let filas = $state<Fila[] | null>(null);
  let productos = $state<Product[]>([]);
  let unidades = $state<UnitType[]>([]);
  let error = $state<string | null>(null);

  // Formulario
  let editId = $state<string | null>(null);
  let abierto = $state(false);
  let fProducto = $state("");
  let fUnidad = $state("");
  let fImporte = $state("");
  let fDesde = $state("");
  let fHasta = $state("");
  let fError = $state<string | null>(null);
  let guardando = $state(false);

  async function cargar(): Promise<void> {
    error = null;
    try {
      [filas, productos, unidades] = await Promise.all([
        get<Fila[]>("/tarifas"),
        get<Product[]>("/productos"),
        get<UnitType[]>("/unidades"),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : "Error";
    }
  }
  $effect(() => {
    if (!filas) cargar();
  });

  function nueva(): void {
    editId = null;
    fProducto = productos[0]?.id ?? "";
    fUnidad = unidades[0]?.id ?? "";
    fImporte = "";
    fDesde = new Date().toISOString().slice(0, 10);
    fHasta = "";
    fError = null;
    abierto = true;
  }

  function editar(r: Fila): void {
    editId = r.id;
    fProducto = r.productId;
    fUnidad = r.unitTypeId;
    fImporte = centimosATexto(r.amountPerUnit);
    fDesde = r.validFrom;
    fHasta = r.validTo ?? "";
    fError = null;
    abierto = true;
  }

  async function guardar(): Promise<void> {
    const centimos = eurosACentimos(fImporte);
    if (centimos === null) {
      fError = "Importe no válido";
      return;
    }
    if (!fDesde) {
      fError = "Falta la fecha de inicio";
      return;
    }
    guardando = true;
    fError = null;
    const body = {
      productId: fProducto,
      unitTypeId: fUnidad,
      amountPerUnit: centimos,
      validFrom: fDesde,
      validTo: fHasta || null,
    };
    try {
      await api(editId ? `/tarifas/${editId}` : "/tarifas", {
        metodo: editId ? "PUT" : "POST",
        body,
      });
      abierto = false;
      filas = null;
      await cargar();
    } catch (e) {
      fError = e instanceof Error ? e.message : "Error al guardar";
    } finally {
      guardando = false;
    }
  }

  let borrarId = $state<string | null>(null);
  async function borrar(id: string): Promise<void> {
    try {
      await api(`/tarifas/${id}`, { metodo: "DELETE" });
      borrarId = null;
      filas = null;
      await cargar();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al borrar";
    }
  }
</script>

<h1>Tarifas</h1>
<p style="color:var(--suave)">
  Precio por unidad (céntimos internamente). La liquidación usa la tarifa vigente
  según la fecha del parte.
</p>

{#if error}<p class="aviso">{error}</p>{/if}

<p><button type="button" class="primario" onclick={nueva}>Nueva tarifa</button></p>

{#if abierto}
  <div class="tarjeta" style="max-width:520px;margin-bottom:16px">
    <h2 style="margin-top:0">{editId ? "Editar tarifa" : "Nueva tarifa"}</h2>
    <div style="display:grid;gap:10px">
      <label>Producto
        <select bind:value={fProducto}>
          {#each productos as p (p.id)}
            <option value={p.id}>{p.name}{p.variedad ? ` · ${p.variedad}` : ""}</option>
          {/each}
        </select>
      </label>
      <label>Unidad
        <select bind:value={fUnidad}>
          {#each unidades as u (u.id)}
            <option value={u.id}>{u.name} ({u.abbr})</option>
          {/each}
        </select>
      </label>
      <label>Importe por unidad (€)
        <input type="text" inputmode="decimal" bind:value={fImporte} placeholder="0,18" />
      </label>
      <label>Vigente desde <input type="date" bind:value={fDesde} /></label>
      <label>Vigente hasta (opcional) <input type="date" bind:value={fHasta} /></label>
      {#if fError}<p class="aviso">{fError}</p>{/if}
      <div style="display:flex;gap:8px">
        <button type="button" class="primario" disabled={guardando} onclick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onclick={() => (abierto = false)}>Cancelar</button>
      </div>
    </div>
  </div>
{/if}

{#if !filas}
  <p class="cargando">Cargando…</p>
{:else if filas.length === 0}
  <p class="vacio">Todavía no hay tarifas.</p>
{:else}
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Unidad</th>
          <th>Importe / ud.</th>
          <th>Desde</th>
          <th>Hasta</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each filas as r (r.id)}
          <tr>
            <td>{r.producto}</td>
            <td>{r.unidad}</td>
            <td>{eur(r.amountPerUnit)}</td>
            <td>{r.validFrom}</td>
            <td>{r.validTo ?? "abierta"}</td>
            <td style="white-space:nowrap">
              <button type="button" onclick={() => editar(r)}>Editar</button>
              {#if borrarId === r.id}
                <button type="button" class="aviso" onclick={() => borrar(r.id)}>
                  Confirmar
                </button>
                <button type="button" onclick={() => (borrarId = null)}>No</button>
              {:else}
                <button type="button" onclick={() => (borrarId = r.id)}>Borrar</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
