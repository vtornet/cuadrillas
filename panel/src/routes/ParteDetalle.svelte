<script lang="ts">
  import type { Shift, Worker, Entry } from "@cuadrilla/shared";
  import { sumarConteos } from "@cuadrilla/shared/domain";
  import { api } from "../lib/api";

  let { id }: { id: string } = $props();

  type ShiftDet = Shift & {
    cuadrilla: string;
    producto: string;
    unidad: string;
  };
  interface Datos {
    shift: ShiftDet;
    entries: Entry[];
    workers: Worker[];
  }

  let datos = $state<Datos | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    api<Datos>(`/partes/${id}`)
      .then((d) => (datos = d))
      .catch((e) => (error = e instanceof Error ? e.message : "Error"));
  });

  const conteos = $derived(datos ? sumarConteos(datos.entries) : {});

  const recolectores = $derived(
    (datos?.workers ?? [])
      .filter((w) => w.funcion !== "auxiliar")
      .map((w) => ({ w, u: conteos[w.id] ?? 0 }))
      .sort((a, b) => b.u - a.u || a.w.name.localeCompare(b.w.name, "es")),
  );
  const auxiliares = $derived(
    (datos?.workers ?? [])
      .filter((w) => w.funcion === "auxiliar")
      .map((w) => {
        const a = datos?.shift.auxiliares?.find((x) => x.workerId === w.id);
        return { w, tarea: a?.tarea ?? "", horas: a?.horas ?? null };
      }),
  );
  const total = $derived(
    recolectores.reduce((n, r) => n + r.u, 0) +
      (datos?.shift.groups ?? []).reduce(
        (n, g) => n + (conteos[g.groupId] ?? 0),
        0,
      ),
  );
</script>

<p style="margin-bottom:12px">
  <a href="#/partes">‹ Partes</a>
</p>

{#if error}
  <p class="aviso">{error}</p>
{:else if !datos}
  <p class="cargando">Cargando…</p>
{:else}
  {@const s = datos.shift}
  <h1>Parte del {s.fecha}</h1>
  <dl class="pares">
    <dt>Cuadrilla</dt><dd>{s.cuadrilla}</dd>
    <dt>Producto</dt><dd>{s.producto} · {s.unidad}</dd>
    {#if s.finca}<dt>Finca</dt><dd>{s.finca}</dd>{/if}
    <dt>Horario</dt>
    <dd>{s.horaInicio ?? "—"} – {s.horaFin ?? "…"}</dd>
    <dt>Estado</dt><dd>{s.estado === "open" ? "Abierto" : "Cerrado"}</dd>
    {#if s.firmante}<dt>Firmado por</dt><dd>{s.firmante}</dd>{/if}
  </dl>

  <h2>Recolectores ({recolectores.length})</h2>
  <div class="tabla-wrap">
    <table class="datos">
      <thead>
        <tr><th>Nombre</th><th>{s.unidad || "Unidades"}</th></tr>
      </thead>
      <tbody>
        {#each recolectores as r (r.w.id)}
          <tr><td>{r.w.name}</td><td>{r.u}</td></tr>
        {/each}
        {#each datos.shift.groups ?? [] as g (g.groupId)}
          <tr><td>{g.name} (grupo)</td><td>{conteos[g.groupId] ?? 0}</td></tr>
        {/each}
        <tr>
          <td><strong>TOTAL</strong></td>
          <td><strong>{total}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  {#if auxiliares.length > 0}
    <h2>Auxiliares ({auxiliares.length})</h2>
    <div class="tabla-wrap">
      <table class="datos">
        <thead>
          <tr><th>Nombre</th><th>Tarea</th><th>Horas</th></tr>
        </thead>
        <tbody>
          {#each auxiliares as a (a.w.id)}
            <tr>
              <td>{a.w.name}</td>
              <td>{a.tarea || "—"}</td>
              <td>{a.horas ?? "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if s.observaciones}
    <h2>Observaciones</h2>
    <p style="white-space:pre-wrap">{s.observaciones}</p>
  {/if}

  {#if s.firma}
    <h2>Firma</h2>
    <img
      src={s.firma}
      alt="Firma"
      style="max-width:240px;border:1px solid var(--linea)"
    />
  {/if}
{/if}
