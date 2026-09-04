# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

PWA para jefes de cuadrilla que trabajan a destajo. Registro en campo **sin cobertura**,
estadísticas y liquidaciones. Monorepo pnpm con 3 paquetes.

## Comandos

Requisitos: Node ≥ 20, pnpm 9.

```bash
pnpm install            # la primera vez descarga un binario de MongoDB (mongodb-memory-server), tarda
pnpm dev                # PWA en :5173. Modo demo salvo que app/.env tenga VITE_API_URL
pnpm dev:api            # backend en :8080 (necesita un MongoDB: docker run -p 27017:27017 mongo:7)
pnpm dev:all            # ambos
pnpm build              # build de los 3 paquetes
pnpm preview            # sirve la PWA compilada — ÚNICA forma de probar el service worker / offline (el SW está desactivado en dev)
pnpm typecheck          # tsc --noEmit (shared, api) + svelte-check (app)
pnpm test               # vitest en los 3 paquetes
```

Un solo paquete / un solo test:

```bash
pnpm --filter @cuadrilla/shared test                    # solo shared
pnpm --filter @cuadrilla/shared test -- merge           # solo archivos que casan "merge"
pnpm --filter @cuadrilla/shared test -- -t "LWW"        # filtra por nombre del test (-t)
pnpm --filter @cuadrilla/app test tests/jornada.test.ts # un archivo concreto
```

`api` compila con `tsup` a un único `dist/index.js` (ESM) con `@cuadrilla/shared` incluido;
`express`/`mongoose`/`stripe` quedan externos. `shared` **no se compila**: se consume como
código fuente `.ts` vía alias (`@cuadrilla/shared` → `shared/src/index.ts`,
`@cuadrilla/shared/domain` → `shared/src/domain/index.ts`), definido en `vite.config.ts`,
`vitest.config.ts` y los `paths` de cada `tsconfig.json`.

## Arquitectura

### Los 3 paquetes

- **`shared/`** — tipos + **lógica de dominio pura** (`shared/src/domain/`). Sin IO, sin
  framework. Se usa **igual en cliente y servidor**. Aquí vive todo lo testeable de verdad:
  `merge.ts` (LWW), `settlement.ts` (liquidación), `stats.ts` (estadísticas),
  `rates.ts` (tarifa vigente), `entries.ts` (conteos).
- **`app/`** — PWA Vite + Svelte 5 (runes) + `vite-plugin-pwa`. IndexedDB con Dexie.
- **`api/`** — Express 4 + Mongoose 8 + zod. Enlace mágico + `/sync` + Stripe.

### Offline-first (la restricción central)

Toda escritura va **primero a IndexedDB** mediante `persistir()`
(`app/src/lib/db/repositories/base.ts`): en una transacción escribe el registro **y**
encola un `PendingOp`. La sincronización ocurre en segundo plano. Ningún flujo de la
pantalla de Registro toca el servidor.

`persistir()` clona el registro con `JSON.parse(JSON.stringify(...))` antes de escribir:
un proxy de `$state` de Svelte no se puede clonar en IndexedDB (`DataCloneError`, típico
con arrays anidados como `attendeeIds`).

### Sincronización (LWW por registro)

- Cliente: `app/src/lib/sync/engine.ts` → `sincronizar()`: envía `pendingOps` a
  `POST /sync` con `{ lastSyncAt, ops }`, aplica `changes` (LWW), borra las `applied` de la
  cola, revierte las `rejected` (borra el registro local huérfano), guarda
  `lastSyncAt = serverTime`.
- Servidor: `api/src/services/syncService.ts` → por cada op, `entranteGana()` compara
  `updatedAt` (epoch ms del cliente); **fuerza `organizationId` al del token**; valida
  límites de plan; pone `serverUpdatedAt` (Date del servidor) en cada escritura.
  El pull son los docs con `serverUpdatedAt > lastSyncAt` — **nunca** se compara contra el
  reloj del cliente.
- Disparadores de sync: al volver la red, rebote de 2 s tras cada escritura local, y cada
  30 s (`app/src/lib/sync/status.svelte.ts`).

### Entidades sincronizables

`organization, crew, worker, product, unitType, rate, shift, entry` (union `EntityName` +
array `ENTIDADES` en shared). Todas comparten:
`{ id, organizationId, updatedAt, deleted }` donde `id` es un **UUID de cliente** que es
también el `_id` de Mongo, y `deleted` es `0|1` en el cliente / `boolean` en el servidor
(se convierte en la capa de sync).

El servidor no tiene un modelo por entidad: `api/src/models/sync.ts` expone
`Modelos: Record<EntityName, Model>` con `strict: false` (guarda campos arbitrarios); la
forma se valida en `syncService`. El cliente tiene el equivalente en
`app/src/lib/db/tablas.ts` (`tablaPorEntidad`).

### Estado (Svelte 5 runes)

Stores singleton en archivos `*.svelte.ts`:

- `auth.svelte.ts` — `estado: cargando | anonimo | demo | autenticado`. Sin `VITE_API_URL`
  o pulsando "modo demo" → siembra `dev/seed.ts` y no sincroniza. Login real = enlace
  mágico → JWT (365 d) guardado en la tabla `meta`. `auth.token` NO es reactivo (solo lo
  usa el motor de sync).
- `sesion.svelte.ts` — getters que derivan de `auth` (userId, organizationId, rol).
- `jornada.svelte.ts` — parte (jornada) activo + registro optimista (contador en pantalla
  síncrono <100 ms, IndexedDB + cola después). `activeShiftId` en `meta`. **Un solo parte
  activo a la vez** (simplificación deliberada, sin selector de "otras jornadas abiertas").
- `gestion.svelte.ts` — CRUD genérico `guardar(tipo, record)` / `eliminar(tipo, record)`.
- `router.svelte.ts` — router por hash (`#/registro`, …). Vistas: registro, estadisticas,
  liquidacion, gestion, cuenta. **No hay pantalla "jornada" separada**: `Registro.svelte`
  es autosuficiente — con parte activo muestra el registro normal y un botón "Finalizar
  jornada" al final de la lista; sin parte activo, un botón "Comenzar jornada" que abre
  `ComenzarJornadaSheet.svelte` (hoja modal con cuadrilla/producto/unidad/fecha/hora/
  asistencia).
- `syncStatus` — estado de sync + auto-disparo.

### Dinero

Siempre **céntimos enteros**. `Rate.amountPerUnit` = céntimos. Conversiones en
`app/src/lib/money.ts`. La tarifa se resuelve por `Shift.fecha` (día natural), **no** por
el timestamp de cada registro (`resolverTarifa` en `shared/domain/rates.ts`).

### Planes / Stripe

`plan` y `planLimits` viven en el documento `Organization`, que es una entidad
sincronizada. El webhook de Stripe (`api/src/services/billingService.ts` →
`procesarEventoStripe`) actualiza el plan y bumpea `serverUpdatedAt` para que el cliente
lo reciba en el siguiente `/sync`. `syncService.dentroDelLimite` lee `org.planLimits`.
Sin `STRIPE_SECRET_KEY` los endpoints de pago responden 503 y la UI de plan no aparece.

## Convenciones

- **Idioma**: tipos en inglés (`Worker`, `Shift`, `Entry`, `Rate`); funciones, variables y
  comentarios en español (`crearShift`, `persistir`, `sumarConteos`, `importeCentimos`).
- **Sin dependencias pesadas**: CSS propio con tokens (`app/src/styles/tokens.css`),
  gráficos en SVG/CSS a mano (nada de Chart.js), `xlsx` (SheetJS) solo con `import()`
  dinámico. Justifica cualquier dependencia nueva.
- **UI de campo**: objetivos táctiles ≥ 56 px (`--tap`), alto contraste, tema claro
  (uso a pleno sol). Modales = hojas inferiores (`.overlay` + `.hoja`). Las fichas
  editables (`EditSheet.svelte`) NO se cierran al tocar fuera y preguntan si hay cambios
  sin guardar.
- **i18n**: `i18n.t("clave", { var })`, locales en `app/src/lib/i18n/locales/`. `es` es el
  fallback. `ro/ar/fr` están preparados pero sin traducir (MVP: solo es/en).
- **Datos demo** (`app/src/lib/dev/seed.ts`): solo en modo demo; se borran al hacer login
  real o `auth.salir()`. Se escriben SIN encolar en `pendingOps`.

## Tests

- `shared/tests/` — vitest plano sobre las funciones de dominio.
- `app/tests/` — `import "fake-indexeddb/auto"` para probar repos y stores. Los stores de
  runes (`*.svelte.ts`) funcionan gracias al plugin de svelte en `app/vitest.config.ts`.
- `api/tests/` — `mongodb-memory-server` (binario cacheado tras el primer `pnpm install`)
  + `supertest`. `fileParallelism: false`.

## Estado

MVP completo (8 pasos). Fuera del MVP, preparado pero no implementado: panel
multi-cuadrilla, vista del trabajador, NFC, i18n completo, fotos de albaranes, pantalla
RGPD (política de privacidad + export/borrado de datos de un trabajador).

### Transporte (hecho)

`Worker.transporteCentimos` (0 = no se le paga). En la liquidación,
`calcularLiquidacion` cuenta `diasTrabajados` (fechas distintas con asistencia o
registro) y `transporteCentimos = transporte/día × diasTrabajados`. `Liquidacion` separa
`destajoCentimos` / `transporteCentimos` / `totalCentimos`. La pantalla y los exports
(CSV resumen por trabajador, XLSX hoja "Resumen") muestran el transporte en columna
aparte. Formulario en `gestion/WorkerForm.svelte` (checkbox + importe).

### Reestructuración "el parte" (en marcha, 2026-09-04)

Perfil de usuario bajo → simplificar. Plan en 4 fases:

- **Fase A — hecho.** `Jornada.svelte` desaparece. `Registro.svelte` es autosuficiente:
  botón "Comenzar jornada" (`ComenzarJornadaSheet.svelte`, hoja modal) cuando no hay parte
  activo; botón "Finalizar jornada" al final de la lista (con confirmación) cuando lo hay.
  Un solo parte activo a la vez (se quitó el selector de "otras jornadas abiertas" — ver
  `jornadasAbiertas()` en `shifts.ts`, que ahora solo debería devolver 0 o 1).
- **Fase B — hecho.** Pestaña "Cuadrillas" en `Gestion.svelte` (`CrewForm.svelte`):
  crear/renombrar/eliminar. Asignar trabajadores sigue siendo el selector de
  `WorkerForm.svelte`; la ficha de la cuadrilla lista sus trabajadores (solo lectura) con
  un atajo que abre directamente `WorkerForm` para ese trabajador (`gestion.trabajadoresDe`,
  callback `oneditarworker` hacia `Gestion.svelte`). Eliminar una cuadrilla solo se permite
  sin trabajadores asignados (si tiene, se oculta el botón y se explica por qué).
- **Fase C — hecho.** Pantalla "Historial" (`Historial.svelte` + `ParteDetalle.svelte`):
  lista de partes cerrados (`estado: "closed"`) → modo consulta (filas de solo lectura,
  `.hist-fila`) → botón Editar con aviso + confirmación inline → modo edición reutiliza
  `WorkerRow`/`WorkerSheet` tal cual (ya estaban desacoplados del store `jornada` vía props
  callback) para añadir/anular anotaciones, sin tocar `estado` del `Shift` ni el
  `activeShiftId`. Estado (workers/entries/conteos) vive local al componente, no en un
  store singleton — a diferencia de `jornada.svelte.ts`, aquí no hace falta persistencia
  entre pantallas ni pila de deshacer.
- **Fase D — pendiente.** Grupos: entidad persistente y editable a nivel de cuadrilla
  (como los trabajadores, gestionable desde Gestión), **no** efímera por parte — así no
  hay que recrearlos cada día; si falta alguien un día, se edita el grupo al vuelo. Al
  comenzar un parte, opción "trabajar por grupos" → elegir qué grupos trabajan hoy. El
  parte activo muestra tarjetas de grupo en vez de trabajador (tocar abre modal con
  miembros + total). En liquidación, las unidades del grupo se reparten **a partes
  iguales** entre sus miembros de ese parte (sin arrastrar ausencias de otros días, porque
  la composición se ajusta cada vez).
- **Firma del jefe al finalizar**: capturar firma (canvas) al finalizar un parte y
  guardarla con el `Shift` (data URL/blob); mostrarla en el historial/liquidación. Sin
  fase asignada todavía.
