# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

PWA para jefes de cuadrilla que trabajan a destajo. Registro en campo **sin cobertura**,
estadísticas y asistencia. Monorepo pnpm con 3 paquetes.

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
  `merge.ts` (LWW), `settlement.ts` (liquidación — sin UI en el cliente del jefe, ver
  nota en "Dinero"), `stats.ts` (estadísticas), `rates.ts` (tarifa vigente),
  `entries.ts` (conteos), `attendance.ts` (tabla mensual de asistencia), `rgpd.ts`
  (informe + anonimización de un trabajador), `products.ts` (`etiquetaProducto`).
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
- `router.svelte.ts` — router por hash (`#/registro`, …). Vistas: registro, historial,
  estadisticas, asistencia, gestion, cuenta, privacidad. **No hay pantalla "jornada" separada**: `Registro.svelte`
  es autosuficiente — con parte activo muestra el registro normal y un botón "Finalizar
  jornada" al final de la lista; sin parte activo, un botón "Comenzar jornada" que abre
  `ComenzarJornadaSheet.svelte` (hoja modal con cuadrilla/producto/unidad/fecha/hora/
  asistencia).
- `syncStatus` — estado de sync + auto-disparo.

### Dinero

Siempre **céntimos enteros**. `Rate.amountPerUnit` = céntimos. Conversiones en
`app/src/lib/money.ts`. La tarifa se resuelve por `Shift.fecha` (día natural), **no** por
el timestamp de cada registro (`resolverTarifa` en `shared/domain/rates.ts`).

**Nota (2026-09-07):** la app del jefe de cuadrilla **ya no maneja datos económicos**.
La pantalla Liquidación, sus exports y la pestaña "Tarifas" de Datos se han quitado. La
entidad `Rate` sigue sincronizándose y `shared/domain/settlement.ts` + `rates.ts` +
tests se conservan intactos para un futuro **panel de empresa/gestor** que calcule
liquidaciones. `money.ts` sigue en uso (transporte en `WorkerForm`, importes en el
informe RGPD, parseo en el import de trabajadores).

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
multi-cuadrilla, vista del trabajador, NFC, i18n completo, fotos de albaranes.

### Despliegue (en marcha, 2026-09-05)

Checklist completa por fases en `DEPLOY.md` (raíz del repo). Fase 1 (PWA en modo demo,
Cloudflare Workers, dominio `cuadrillas.app`) **hecha**. Fase 2 (backend: MongoDB Atlas +
Railway) **hecha**: cluster Atlas M0 (`vtornet_db_user`, red `0.0.0.0/0`), API en Railway
(root dir `/`, variables `MONGODB_URI`/`JWT_SECRET`/`APP_URL`) con dominio propio
`api.cuadrillas.app` (CNAME en Cloudflare, DNS only sin proxy), y `VITE_API_URL` puesta en
el Worker de Cloudflare — la PWA en `cuadrillas.app` ya sale del modo demo y habla con el
backend real. Fase 3 (email real con Resend) **hecha**: dominio `cuadrillas.app`
verificado en Resend (SPF/MX en el subdominio `send.`, DKIM en `resend._domainkey`, sin
tocar el SPF/MX de raíz que usa el reenvío de correo de Namecheap), `RESEND_API_KEY` y
`EMAIL_FROM=Cuadrillas <login@cuadrillas.app>` puestas en Railway — el enlace mágico ya
llega por email de verdad. Fase 4 (Stripe) **hecha en modo test**: 3 productos/precios
(jefe de cuadrilla, empresa, campaña) y webhook a `https://api.cuadrillas.app/webhooks/stripe`
configurados en Stripe; `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*`/`STRIPE_WEBHOOK_SECRET`
puestas en Railway. Probado end-to-end con tarjeta de prueba: checkout → webhook → la
organización pasa a `plan: "foreman"` con `subscriptionStatus: "active"`. Pendiente:
repetir con claves **live** cuando se quiera cobrar de verdad (clave secreta live,
price ids live que ya existen en Stripe, webhook nuevo apuntando a producción). Con
esto, **las 4 fases de `DEPLOY.md` están completas en modo test/demo** — el pendiente
real antes de usuarios de pago es pasar Stripe a modo live. La pantalla RGPD ya está
implementada (2026-09-07, ver más abajo); falta solo rellenar en la política los datos
concretos de Appstracta (dirección, CIF, correo de contacto).

### Transporte (hecho)

`Worker.transporteCentimos` (0 = no se le paga). Formulario en
`gestion/WorkerForm.svelte` (checkbox + importe). En `settlement.ts` (dominio, ya sin
pantalla en la app del jefe — ver nota en "Dinero"), `calcularLiquidacion` cuenta
`diasTrabajados` (fechas distintas con asistencia o registro) y
`transporteCentimos = transporte/día × diasTrabajados`; `Liquidacion` separa
`destajoCentimos` / `transporteCentimos` / `totalCentimos`. Queda para el futuro panel
de empresa/gestor.

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
- **Fase D — hecho.** Grupos: entidad persistente y editable a nivel de cuadrilla
  (`Group` — pestaña "Grupos" en `Gestion.svelte` / `GroupForm.svelte`, igual que
  trabajadores). Al comenzar un parte, `ComenzarJornadaSheet` ofrece "trabajar por
  grupos" → se eligen qué grupos trabajan hoy y su composición se copia como snapshot
  (`Shift.groups: GrupoDeJornada[]`, filtrado a la asistencia marcada) — así el grupo
  fijo de Gestión no se toca, y si falta alguien ese día el jefe lo desmarca en el
  parte (`jornada.actualizarGrupoDeHoy`, editable también desde `ParteDetalle` en modo
  edición). El parte activo muestra tarjetas de grupo en vez de trabajador
  (`Registro.svelte`, `WorkerRow` generalizado con prop `item: {name, alias}`; tocar
  abre `GroupSheet.svelte` con miembros de hoy + anotaciones). `Entry.workerId` /
  `Entry.groupId` son ambos opcionales y mutuamente excluyentes; `sumarConteos` indexa
  por el que esté presente. En liquidación (`settlement.ts`), las unidades y el importe
  de cada anotación de grupo se reparten **a partes iguales** en céntimos exactos
  (floor + reparto determinista del resto) entre los `memberIds` del snapshot de ESE
  parte — sin arrastrar ausencias de otros días. Fuera de alcance de esta fase (gap
  conocido, no corrupción): Estadísticas por trabajador ignora las anotaciones de
  grupo (`stats.ts`, guardado explícitamente).
- **Firma del jefe al finalizar — hecho.** Al pulsar "Finalizar jornada" en
  `Registro.svelte` se abre `FirmaSheet.svelte`: aviso de cierre + un `<canvas>` táctil
  (Pointer Events, con `setPointerCapture` para no perder el trazo al salir del recuadro)
  y dos acciones, "Finalizar sin firmar" o "Firmar y finalizar" (deshabilitado hasta que
  hay trazo). La firma se guarda como PNG en data URL en `Shift.firma` (opcional;
  `jornada.cerrarActual(firma?)`), y se muestra de solo lectura en `ParteDetalle.svelte`
  (Historial). No se pidió ni se implementó en Liquidación (vista agregada por
  trabajador/periodo, sin hueco natural para una firma por parte individual). Firmar es
  opcional a propósito — un parte se puede cerrar sin firma sin fricción extra.
- **Renombrado de menús + import de trabajadores — hecho (2026-09-07).** En el menú,
  "Registrar" pasa a **"Iniciar parte"** y "Gestión" a **"Datos"** (claves i18n
  `menu.registrar` / `menu.gestion` y `gestion.titulo`; solo cambian los textos, no las
  vistas ni las rutas `#/registro` `#/gestion`). Import de trabajadores desde Excel/CSV:
  `app/src/lib/import/workers.ts` (`filasDeArchivo` carga SheetJS bajo demanda →
  `sheet_to_json` matriz; `construirWorkers` puro: mapea cabeceras sin acentos/mayúsculas
  —Nombre/Alias/Cuadrilla/Idioma/Transporte/QR/Activo—, valida fila a fila, dedup por
  `crewId::alias` contra los existentes y dentro del propio archivo). UI:
  `gestion/ImportWorkersSheet.svelte` (botón "Importar de Excel/CSV" en la pestaña
  Trabajadores → hoja con `<input type=file>` oculto → previsualización de válidos +
  errores por fila → confirmar). `gestion.importarWorkers()` persiste cada uno vía
  `persistir` (se encola en `pendingOps` como un alta manual). Archivo de ejemplo en
  `ejemplos/trabajadores-ejemplo.xlsx`. Solo Nombre es obligatorio; sin columna Cuadrilla
  se usa la única que haya (error si hay varias).

### Prioridades (orden sugerido, 2026-09-07)

Los detalles de cada punto están en **Backlog sin planificar** justo debajo.

**Antes de dar de alta usuarios reales**

1. **Pantalla RGPD** (privacidad + export/borrado de datos de un trabajador). **HECHO
   (2026-09-07)** salvo rellenar los datos de Appstracta en la política.
2. **Perfil del jefe de cuadrilla** (nombre, empresa, NIF, teléfono). **HECHO
   (2026-09-07).** Sección "Perfil" en Cuenta.
   - 2b. **Nombre del jefe junto a la firma** (`Shift.firmante?`). **HECHO (2026-09-07).**

**Pivote de producto: el jefe de cuadrilla no maneja economía** (decidido 2026-09-07)

3. **Eliminar la sección Liquidación.** **HECHO (2026-09-07).** Fuera: vista, menú,
   exports CSV/XLSX, pestaña "Tarifas". `settlement.ts` + `rates.ts` + tests se conservan.
4. **Tabla mensual de asistencia.** **HECHO (2026-09-07).** Vista `#/asistencia`.
5. **Enviar asistencia desde un parte.** **HECHO (2026-09-07).** Botón en `Registro`
   (parte activo) y `ParteDetalle` (Historial).

**Modelo de datos (base para el resto)** — necesitan conversación de modelado con el usuario

6. **Producto → separar "producto" y "variedad".** **HECHO (2026-09-07).** Dos campos
   en `Product` (`name` + `variedad?`), etiqueta "Naranja · Navelina".
7. **Auxiliares** (trabajadores que no cobran a destajo). **HECHO (2026-09-07).**
   `Worker.funcion` + sección aparte en el parte + tarea/horas por día.
8. **Cabecera del parte** (fecha, finca, producto·variedad, nº recolectores/auxiliares).
   **HECHO (2026-09-07).** `Shift.finca` (texto libre) + `CabeceraParte.svelte`.

**Mejoras rápidas e independientes**

9. **Aviso al finalizar si hay recolectores a 0** (`FirmaSheet` / `jornada.cerrarActual`).
10. **Estadísticas por trabajador: integrar anotaciones de grupo** (gap conocido Fase D).

**Bloqueadas esperando decisión del usuario**

11. **Estructura de navegación** (más renombrados de menús / cambios de estructura).

**Cuando toque cobrar de verdad**

12. **Pasar Stripe a modo live** (ver `DEPLOY.md`).

**Fuera de MVP (preparado, no implementado)**

13. Panel multi-cuadrilla · vista del trabajador · NFC · i18n completo (ro/ar/fr) · fotos
    de albaranes.

### Backlog sin planificar

- **Auxiliares — hecho (2026-09-07).** Recolectores (destajo por unidad) vs auxiliares
  (carga, paletizado, pesaje…). Decidido: rol **fijo en la ficha** (`Worker.funcion?:
  "recolector" | "auxiliar"`, ausente = recolector), en el parte salen en **sección
  aparte sin contador**, y por día se anota **tarea + horas (horas opcional)**. El
  cálculo de pago del auxiliar (jornal/horas/tarifa) queda para el futuro panel de
  empresa — la app del jefe no maneja economía.
  - `Worker.funcion` (selector "Función" en `WorkerForm`). `Shift.auxiliares?:
    AuxiliarDeJornada[]` (`{ workerId, tarea?, horas? }`), poblado bajo demanda.
  - `jornada`: getters `recolectores` / `auxiliares` (`AuxiliarConTrabajo`), método
    `actualizarAuxiliar(workerId, {tarea, horas})` (persiste en el Shift; si ambos vacíos
    borra la entrada). Igual en `ParteDetalle` (`actualizarAuxiliar` local).
  - UI: `Registro.svelte` lista recolectores con contador + bloque "Auxiliares" (tarea·
    horas, tap → `AuxiliarSheet.svelte`); `ParteDetalle` los muestra en consulta (solo
    lectura) y editables en edición; QR de un auxiliar se ignora. `EnviarAsistenciaSheet`
    / `textoAsistenciaParte` separan "Trabajadores" y "Auxiliares".
  - `stats.ts`: los auxiliares quedan **fuera** del ranking, medias y unidades/hora
    (`funcion === "auxiliar"`). `attendance.ts` (tabla mensual) los sigue incluyendo
    (gap: no separa totales por rol — va con "Cabecera del parte").
  - Seed demo: el último trabajador es auxiliar. Tests: `shared/tests/stats.test.ts`,
    `app/tests/jornada.test.ts`, `app/tests/asistencia-parte.test.ts`.
- **Estructura de navegación.** Primer lote de renombrados de menús ya aplicado (ver
  arriba: "Iniciar parte", "Datos"). Quedan pendientes más cambios de nombres/estructura
  que el usuario irá explicando.
- **Eliminar la sección Liquidación — hecho (2026-09-07).** El jefe de cuadrilla no
  maneja datos económicos. Borrados: `Liquidacion.svelte`, `export/csv.ts`,
  `export/xlsx.ts`, `RateForm.svelte`, `export.test.ts` (el test de `slug` pasó a
  `compartir.test.ts`). Quitada la vista `"liquidacion"` de `router` + `MenuSheet` +
  `App.svelte`, la pestaña **"Tarifas"** de `Gestion.svelte` y `"rate"` de
  `gestion.svelte.ts` (`TipoGestion`, `gestion.rates`). Conservados intactos:
  `shared/domain/settlement.ts` + `rates.ts` (dominio) y sus tests, `app/.../repositories/
  rates.ts`, la entidad `Rate` en `ENTIDADES`/`tablas.ts`/schema Dexie (sigue
  sincronizando) — para un futuro panel de empresa/gestor. `Estadisticas.svelte` ya era
  de unidades/horas, sin dinero (confirmado). `xlsx` (dependencia) se queda: lo usa el
  import de trabajadores. i18n: fuera `menu.liquidacion`, secciones `liq`/`export`,
  claves `gestion.tarifa*`/`desde_fecha`.
- **Tabla mensual de asistencia — hecho (2026-09-07).** Vista `Asistencia.svelte`
  (`router` `"asistencia"`, entrada en `MenuSheet` entre Estadísticas y Datos). Dominio
  puro `shared/domain/attendance.ts` → `asistenciaMensual(shifts, workers, anio, mes)`:
  rejilla días 1..N (con `finDeSemana`), fila por trabajador con `presente[]` (true si
  está en `Shift.attendeeIds` de algún parte no borrado de ese día), `total` por
  trabajador, `totalPorDia`, `totalGeneral`. Incluye trabajadores `activo:1` **o**
  inactivos con actividad ese mes; excluye borrados. Vista: nav de mes (‹ mes ›, "mes
  siguiente" bloqueado en el mes actual), tabla con **primera columna y cabecera
  sticky**, scroll horizontal, fin de semana y día de hoy resaltados, fila de totales.
  Export CSV (`app/src/lib/export/asistencia.ts` → `asistenciaACsv`, "X" por asistencia +
  fila de totales) vía `compartirArchivo`. Sin datos económicos. Tests:
  `shared/tests/attendance.test.ts`, `app/tests/asistencia-export.test.ts`.
  Gap conocido: agrega todas las cuadrillas del jefe sin selector (para el plan
  multi-cuadrilla habría que añadirlo); no distingue "presente sin anotaciones".
- **Enviar asistencia desde un parte — hecho (2026-09-07).** Botón "Enviar asistencia":
  en `Registro.svelte` un enlace bajo la info de la jornada (parte activo); en
  `ParteDetalle.svelte` (Historial, modo consulta) antes de "Volver". Abre
  `EnviarAsistenciaSheet.svelte`: previsualización del texto + acciones **Copiar**
  (`navigator.clipboard` con fallback `execCommand`), **WhatsApp** (`wa.me/?text=`),
  **Email** (`mailto:?subject=&body=`) y **Compartir** (Web Share API `navigator.share
  ({text})`, solo si existe). Texto plano en `app/src/lib/export/asistenciaParte.ts`
  (`textoAsistenciaParte`, puro): cabecera (cuadrilla, fecha DD/MM/AAAA, producto·unidad)
  + lista numerada de asistentes ordenada por nombre + total; si el parte es por grupos,
  añade el desglose por grupo. Sin importes. Los asistentes salen de los `workers`
  cargados (activos), igual que la pantalla. Test: `app/tests/asistencia-parte.test.ts`.
- **Perfil del jefe de cuadrilla + nombre en la firma — hecho (2026-09-07).**
  - **Modelo**: el perfil vive en el documento `Organization` (ya es entidad
    sincronizada). `Organization` ahora `extends RegistroSincronizable` (lleva
    `organizationId` = su propio `id`, como ya hacía el servidor; el seed también). Campos
    nuevos: `contactName` (nombre de la persona), `contactPhone`, `taxId`; `name` = empresa
    / explotación. Se sincroniza con la maquinaria normal (`persistir("organization", …)`
    → `pendingOps`; el servidor guarda campos arbitrarios, `strict:false`). **No** se tocó
    `User` ni se creó endpoint nuevo.
  - **UI**: `perfil.svelte.ts` (store: `cargar`, `guardar`, getters `empresa` /
    `nombreJefe`); `PerfilForm.svelte` en una sección "Perfil" de `Cuenta.svelte` (visible
    en demo y autenticado).
  - **Firma**: `Shift.firmante?: string`. `jornada.cerrarActual(firma?, firmante?)`.
    `FirmaSheet.svelte` muestra "Firma: {nombre}" si el perfil lo tiene; si no, un campo
    de texto para escribirlo esa vez (con aviso de guardarlo en Cuenta › Perfil).
    `ParteDetalle.svelte` lo pinta bajo la firma. Editar un parte cerrado no lo cambia.
  - Tests: `app/tests/perfil.test.ts`, casos nuevos en `app/tests/jornada.test.ts`.
  - **Pendiente**: usar `contactName`/`name`/`taxId` en las cabeceras de exports (va con
    "Cabecera del parte") y en el informe RGPD si se quiere.
- **Cabecera del parte — hecho (2026-09-07).** `Shift.finca?: string` (**texto libre**,
  no entidad; decidido con el usuario). Se escribe al comenzar el parte en
  `ComenzarJornadaSheet` (campo "Finca (opcional)" con `<datalist>` de fincas ya usadas —
  `fincasUsadas(crewIds)` en `db/repositories/shifts`). Componente `CabeceraParte.svelte`
  (título `producto · unidad`; línea meta `finca · fecha · N recolector(es) · M
  auxiliar(es)`) reemplaza la antigua línea `jornada-info` en `Registro.svelte` y
  `ParteDetalle.svelte` — eliminadas la clave i18n `registro.jornada_info` y la clase CSS
  `.jornada-info`. Los conteos salen de `jornada.recolectores.length` /
  `jornada.auxiliares.length` (y equivalentes en `ParteDetalle`). La finca aparece
  también en las filas del Historial y en el texto de "Enviar asistencia"
  (`textoAsistenciaParte` → línea "Finca:"). Seed demo: "Finca El Naranjal". Tests:
  `app/tests/shifts.test.ts` (`fincasUsadas`), `app/tests/asistencia-parte.test.ts`.
  Gap: la tabla mensual de asistencia (`attendance.ts`) sigue sin separar totales por rol
  ni mostrar finca.
- **Producto: producto + variedad — hecho (2026-09-07).** Decidido: **dos campos en el
  mismo `Product`** (no entidades separadas), variedad **opcional**. `Product` ahora
  `{ name, variedad?, activo }` (`name` = producto, p. ej. "Naranja"; `variedad`, p. ej.
  "Navelina"). Helper puro `shared/domain/products.ts` → `etiquetaProducto(p)` =
  "Naranja · Navelina" o "Naranja" si no hay variedad; se usa en `Gestion` (lista +
  `nombreProducto` del store), `ComenzarJornadaSheet`, `UnitForm` (selector de producto),
  `Registro`/`ParteDetalle` (`registro.jornada_info` + `EnviarAsistenciaSheet`),
  `Historial`. Form: `ProductForm.svelte` con campo "Producto" + "Variedad (opcional)"
  (i18n `gestion.producto_nombre` ahora "Producto", nueva `gestion.producto_variedad`).
  Migración: no hace falta — `variedad` es opcional, los `Product` sin ella se muestran a
  secas y sincronizan igual (`strict:false` en el servidor). Seed demo: Naranja ·
  Navelina. `settlement.ts`/`stats.ts` usan `productId` (id), no el nombre — sin cambios.
  Tests: `shared/tests/products.test.ts`, caso nuevo en `app/tests/gestion.test.ts`.
- **Aviso al finalizar si hay recolectores a 0.** Al cerrar una jornada, si algún
  recolector presente no tiene ninguna anotación, mostrar un aviso ("Fulano no tiene
  anotaciones, ¿finalizar con 0?") antes de cerrar, con opción de seguir de todas formas
  o volver a la lista. Encaja en el flujo de `FirmaSheet.svelte` / `jornada.cerrarActual`.
- **Pantalla RGPD — hecho (2026-09-07).**
  - **Borrado = anonimizar** (no borrado físico). `shared/src/domain/rgpd.ts`
    → `anonimizarWorker(worker, nombreGenerico)`: conserva el `Worker` (`deleted: 0`)
    para que el histórico siga resolviéndolo, pone `name` genérico, `alias`
    `ELIMINADO-<id8>` (`aliasAnonimo`), borra `qrCode`/`transporteCentimos`, `language: "es"`,
    `activo: 0`. Los `Entry` solo guardan `workerId`, nada más que raspar.
    `gestion.anonimizarWorker()` lo persiste (encolado como update normal).
  - **Export = hoja legible** (`.txt`), **sin importes de destajo**. Lógica pura
    `informeTrabajador(worker, shifts, entries, resolutores)` en `shared/src/domain/rgpd.ts`;
    glue `app/src/lib/rgpd.ts` (`generarInformeTrabajador`, carga shifts/entries de
    IndexedDB + nombres del store `gestion`); render `app/src/lib/export/rgpd.ts`
    (`informeATexto` / `informeABlob`) → `compartirArchivo`. Los partes por grupos se
    listan como día presente sin desglose individual (mismo gap que Estadísticas).
  - **Ubicación**: (a) sección "Datos personales (RGPD)" en `WorkerForm.svelte` (solo al
    editar un trabajador existente) con Exportar / Anonimizar (confirmación inline);
    (b) pantalla **"Privacidad"** (`app/src/routes/Privacidad.svelte`, `router` vista
    `"privacidad"` — renderizada también en estado anónimo en `App.svelte`, entrada en
    `MenuSheet` y enlace en el login de `Cuenta.svelte`).
  - **Política de privacidad**: responsable = **Appstracta**. Texto en `Privacidad.svelte`
    (no i18n, es un documento). **Pendiente rellenar** los marcadores `[dirección postal]`,
    `[CIF/NIF]`, `[correo de contacto]` (aparece 2 veces). Encargados citados: MongoDB
    Atlas, Railway, Cloudflare, Resend, Stripe.
  - Tests: `shared/tests/rgpd.test.ts`, `app/tests/rgpd.test.ts`.
- Estadísticas por trabajador: integrar las anotaciones de grupo (hoy se ignoran, gap
  conocido de la Fase D).
- Pasar Stripe a modo live cuando se quiera cobrar de verdad (ver `DEPLOY.md`).
