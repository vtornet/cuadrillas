<script lang="ts">
  import { onMount } from "svelte";
  import type {
    Crew,
    Finca,
    Group,
    GrupoDeJornada,
    ModoTrabajo,
    Product,
    UnitType,
    Worker,
  } from "@cuadrilla/shared";
  import { etiquetaProducto } from "@cuadrilla/shared/domain";
  import { i18n } from "../i18n/i18n.svelte";
  import { sesion } from "../stores/sesion.svelte";
  import { jornada } from "../stores/jornada.svelte";
  import { crewsDelForeman } from "../db/repositories/crews";
  import { productosActivos, todasLasUnidades } from "../db/repositories/products";
  import { trabajadoresDeCuadrilla } from "../db/repositories/workers";
  import { gruposActivosDeCuadrilla } from "../db/repositories/groups";
  import { fincasActivas, fincaPorNombreOAlta } from "../db/repositories/fincas";
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
  let groupsPorCrew = $state<Record<string, Group[]>>({});
  let cargado = $state(false);

  let crewId = $state("");
  let modo = $state<ModoTrabajo>("destajo");
  let productId = $state("");
  let unitTypeId = $state("");
  let fincas = $state<Finca[]>([]);
  /** "" = sin finca · "__nueva__" = escribir una nueva · id de finca. */
  let fincaSel = $state("");
  let fincaNueva = $state("");
  let fecha = $state(hoyISO());
  let horaInicio = $state(horaActual());
  let asistentes = $state<Set<string>>(new Set());
  let porGrupos = $state(false);
  let gruposSel = $state<Set<string>>(new Set());
  let comenzando = $state(false);

  const units = $derived(
    allUnits.filter((u) => u.productId === productId || u.productId === null),
  );
  /** Nombre de la finca elegida (o escrita), "" si ninguna. */
  const fincaNombre = $derived(
    fincaSel === "__nueva__"
      ? fincaNueva.trim()
      : (fincas.find((f) => f.id === fincaSel)?.name ?? ""),
  );
  const workersActuales = $derived(workersPorCrew[crewId] ?? []);
  const gruposActuales = $derived(groupsPorCrew[crewId] ?? []);
  const puedeComenzar = $derived(
    !!crewId &&
      !!productId &&
      !!unitTypeId &&
      asistentes.size > 0 &&
      (!porGrupos || gruposSel.size > 0) &&
      !comenzando,
  );

  onMount(async () => {
    crews = await crewsDelForeman(sesion.userId);
    products = await productosActivos(sesion.organizationId);
    allUnits = await todasLasUnidades(sesion.organizationId);
    fincas = await fincasActivas(sesion.organizationId);

    const wpc: Record<string, Worker[]> = {};
    const gpc: Record<string, Group[]> = {};
    for (const c of crews) {
      wpc[c.id] = await trabajadoresDeCuadrilla(c.id);
      gpc[c.id] = await gruposActivosDeCuadrilla(c.id);
    }
    workersPorCrew = wpc;
    groupsPorCrew = gpc;

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

  function toggleGrupo(id: string): void {
    const s = new Set(gruposSel);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    gruposSel = s;
  }

  function alCambiarCuadrilla(): void {
    marcarTodos();
    porGrupos = false;
    gruposSel = new Set();
  }
  /** El modo "por horas" es individual: no se combina con trabajar por grupos. */
  function alCambiarModo(): void {
    if (modo === "horas") {
      porGrupos = false;
      gruposSel = new Set();
    }
  }
  function alCambiarProducto(): void {
    if (!units.some((u) => u.id === unitTypeId)) unitTypeId = primeraUnidad();
  }
  function alActivarGrupos(): void {
    if (porGrupos) gruposSel = new Set(gruposActuales.map((g) => g.id));
    else gruposSel = new Set();
  }

  async function comenzar(): Promise<void> {
    if (!puedeComenzar) return;
    comenzando = true;
    try {
      // Si el jefe ha escrito una finca nueva, se da de alta para que aparezca
      // en el desplegable la próxima vez. El Shift guarda el nombre (texto).
      let finca = fincaNombre;
      if (fincaSel === "__nueva__" && finca) {
        finca = (
          await fincaPorNombreOAlta(sesion.organizationId, finca)
        ).name;
      }

      const groups: GrupoDeJornada[] | undefined = porGrupos
        ? gruposActuales
            .filter((g) => gruposSel.has(g.id))
            .map((g) => ({
              groupId: g.id,
              name: g.name,
              memberIds: g.memberIds.filter((id) => asistentes.has(id)),
            }))
        : undefined;

      const shift = await crearShift({
        organizationId: sesion.organizationId,
        crewId,
        productId,
        unitTypeId,
        finca,
        fecha,
        horaInicio,
        attendeeIds: [...asistentes],
        groups,
        modo,
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
          <span>{i18n.t("jornada.modo")}</span>
          <select bind:value={modo} onchange={alCambiarModo}>
            <option value="destajo">{i18n.t("jornada.modo_destajo")}</option>
            <option value="horas">{i18n.t("jornada.modo_horas")}</option>
          </select>
        </label>

        <label class="campo">
          <span>{i18n.t("jornada.producto")}</span>
          <select bind:value={productId} onchange={alCambiarProducto}>
            {#each products as p (p.id)}
              <option value={p.id}>{etiquetaProducto(p)}</option>
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

        <label class="campo">
          <span>{i18n.t("jornada.finca")}</span>
          <select bind:value={fincaSel}>
            <option value="">{i18n.t("jornada.finca_sin")}</option>
            {#each fincas as f (f.id)}
              <option value={f.id}>{f.name}</option>
            {/each}
            <option value="__nueva__">{i18n.t("jornada.finca_nueva")}</option>
          </select>
        </label>

        {#if fincaSel === "__nueva__"}
          <label class="campo">
            <span>{i18n.t("jornada.finca_nueva_nombre")}</span>
            <input
              type="text"
              bind:value={fincaNueva}
              autocomplete="off"
              placeholder={i18n.t("jornada.finca_ph")}
            />
          </label>
        {/if}

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

        {#if modo === "destajo" && gruposActuales.length > 0}
          <label class="campo campo-check">
            <input
              type="checkbox"
              bind:checked={porGrupos}
              onchange={alActivarGrupos}
            />
            <span>{i18n.t("jornada.trabajar_por_grupos")}</span>
          </label>

          {#if porGrupos}
            <p class="aviso-tarifa">{i18n.t("jornada.elegir_grupos")}</p>
            <ul class="asistencia">
              {#each gruposActuales as g (g.id)}
                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={gruposSel.has(g.id)}
                      onchange={() => toggleGrupo(g.id)}
                    />
                    <span>{g.name}</span>
                  </label>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
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
