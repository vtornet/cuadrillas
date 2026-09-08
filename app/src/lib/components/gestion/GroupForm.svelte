<script lang="ts">
  import { untrack } from "svelte";
  import type { Group } from "@cuadrilla/shared";
  import { gruposPorTrabajador } from "@cuadrilla/shared/domain";
  import { i18n } from "../../i18n/i18n.svelte";
  import { sesion } from "../../stores/sesion.svelte";
  import { gestion } from "../../stores/gestion.svelte";
  import EditSheet from "../EditSheet.svelte";

  let { registro, onclose }: { registro: Group | null; onclose: () => void } =
    $props();

  const { reg, ini } = untrack(() => {
    const reg = registro;
    return {
      reg,
      ini: {
        name: reg?.name ?? "",
        crewId: reg?.crewId ?? gestion.crews[0]?.id ?? "",
        memberIds: [...(reg?.memberIds ?? [])].sort(),
        activo: (reg?.activo ?? 1) === 1,
      },
    };
  });

  let name = $state(ini.name);
  let crewId = $state(ini.crewId);
  let miembros = $state(new Set(ini.memberIds));
  let activo = $state(ini.activo);

  // Trabajadores elegibles: los de la cuadrilla elegida. Si se cambia de
  // cuadrilla, los miembros ya no elegibles se descartan.
  const trabajadores = $derived(
    crewId ? gestion.trabajadoresDe(crewId) : [],
  );

  // Un trabajador solo puede estar en un grupo: mapa workerId -> nombre del OTRO
  // grupo activo al que ya pertenece. Bloquea añadirlo.
  const otroGrupoPorWorker = $derived(
    gruposPorTrabajador(gestion.groups, reg?.id),
  );
  $effect(() => {
    const validos = new Set(trabajadores.map((w) => w.id));
    const filtrados = [...miembros].filter((id) => validos.has(id));
    if (filtrados.length !== miembros.size) miembros = new Set(filtrados);
  });

  function toggle(id: string): void {
    // No se puede añadir a un trabajador que ya está en otro grupo.
    if (!miembros.has(id) && otroGrupoPorWorker.has(id)) return;
    const s = new Set(miembros);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    miembros = s;
  }

  const dirty = $derived.by(() => {
    const actual = [...miembros].sort();
    return (
      name.trim() !== ini.name ||
      crewId !== ini.crewId ||
      activo !== ini.activo ||
      actual.length !== ini.memberIds.length ||
      actual.some((id, i) => id !== ini.memberIds[i])
    );
  });
  const valido = $derived(
    name.trim().length > 0 && !!crewId && miembros.size > 0,
  );

  function construir(): Group {
    return {
      id: reg?.id ?? crypto.randomUUID(),
      organizationId: reg?.organizationId ?? sesion.organizationId,
      name: name.trim(),
      crewId,
      memberIds: [...miembros],
      activo: activo ? 1 : 0,
      updatedAt: Date.now(),
      deleted: 0,
    };
  }
</script>

<EditSheet
  titulo={reg ? i18n.t("gestion.editar_grupo") : i18n.t("gestion.nuevo_grupo")}
  {dirty}
  {valido}
  puedeEliminar={!!reg}
  onguardar={() => gestion.guardar("group", construir())}
  oneliminar={reg ? () => gestion.eliminar("group", reg) : undefined}
  {onclose}
>
  <label class="campo">
    <span>{i18n.t("gestion.grupo_nombre")}</span>
    <input type="text" bind:value={name} autocomplete="off" />
  </label>
  <label class="campo">
    <span>{i18n.t("jornada.cuadrilla")}</span>
    <select bind:value={crewId}>
      {#each gestion.crews as c (c.id)}
        <option value={c.id}>{c.name}</option>
      {/each}
    </select>
  </label>

  <h3>{i18n.t("jornada.asistencia")}</h3>
  {#if trabajadores.length === 0}
    <p class="registro-vacio">{i18n.t("gestion.grupo_sin_cuadrilla")}</p>
  {:else}
    <ul class="asistencia">
      {#each trabajadores as w (w.id)}
        {@const enOtro = otroGrupoPorWorker.get(w.id)}
        {@const bloqueado = !!enOtro && !miembros.has(w.id)}
        <li>
          <label class:grupo-ocupado={bloqueado}>
            <input
              type="checkbox"
              checked={miembros.has(w.id)}
              disabled={bloqueado}
              onchange={() => toggle(w.id)}
            />
            <span>{w.name}</span>
            {#if enOtro}
              <em class="grupo-nota">
                {i18n.t("gestion.grupo_ya_en", { grupo: enOtro })}
              </em>
            {/if}
          </label>
        </li>
      {/each}
    </ul>
    {#if miembros.size === 0}
      <p class="aviso-tarifa">{i18n.t("gestion.grupo_sin_miembros")}</p>
    {/if}
  {/if}

  <label class="campo campo-check">
    <input type="checkbox" bind:checked={activo} />
    <span>{i18n.t("gestion.grupo_activo")}</span>
  </label>
</EditSheet>
