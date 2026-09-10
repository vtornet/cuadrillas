# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

PWA para jefes de cuadrilla que trabajan a destajo. Registro en campo **sin cobertura**,
estadísticas y asistencia. Monorepo pnpm con 3 paquetes.

## Comandos

Requisitos: Node ≥ 20, pnpm 9.

```bash
pnpm install            # la primera vez descarga un binario de MongoDB (mongodb-memory-server), tarda
pnpm dev                # PWA del jefe en :5173. Modo demo salvo que app/.env tenga VITE_API_URL
pnpm dev:api            # backend en :8080 (necesita un MongoDB: docker run -p 27017:27017 mongo:7)
pnpm dev:panel          # panel de empresa en :5175 (necesita el API en :8080)
pnpm dev:all            # PWA + API (no incluye el panel)
pnpm build              # build de los 4 paquetes
pnpm preview            # sirve la PWA compilada — ÚNICA forma de probar el service worker / offline (el SW está desactivado en dev)
pnpm typecheck          # tsc --noEmit (shared, api) + svelte-check (app, panel)
pnpm test               # vitest en los 4 paquetes
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

### Los 4 paquetes

- **`shared/`** — tipos + **lógica de dominio pura** (`shared/src/domain/`). Sin IO, sin
  framework. Se usa **igual en cliente y servidor**. Aquí vive todo lo testeable de verdad:
  `merge.ts` (LWW), `settlement.ts` (liquidación — sin UI en el cliente del jefe, ver
  nota en "Dinero"), `stats.ts` (estadísticas), `rates.ts` (tarifa vigente),
  `entries.ts` (conteos), `attendance.ts` (tabla mensual de asistencia), `rgpd.ts`
  (informe + anonimización de un trabajador), `products.ts` (`etiquetaProducto`).
- **`app/`** — PWA Vite + Svelte 5 (runes) + `vite-plugin-pwa`. IndexedDB con Dexie. Para
  el **jefe de cuadrilla** (campo, offline).
- **`api/`** — Express 4 + Mongoose 8 + zod. Enlace mágico + `/sync` + `/admin` + Stripe.
- **`panel/`** — SPA Vite + Svelte 5, **online** (sin service worker, sin Dexie, sin motor
  de sync). Para el **gestor de empresa** (escritorio). Habla con `/admin/*`. Ver "Panel
  de empresa" en `## Estado`. (Scaffold + Fase B, 2026-09-09.)

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

`organization, crew, worker, group, finca, product, unitType, rate, shift, entry` (union
`EntityName` + array `ENTIDADES` en shared). Todas comparten:
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

Límites de cuadrillas: `LIMITES_PLAN_GRATIS.crews = 2` (2026-09-09, antes 1),
`LIMITES_POR_PLAN.foreman.crews = 2` (`api/src/lib/stripe.ts`); company 25, campaign 3.
Además del rechazo en `/sync`, el cliente avisa **antes** de abrir el formulario:
`gestion.puedeCrearCuadrilla` / `limiteCuadrillas` (lee `Organization.planLimits.crews`);
`Gestion.svelte` `nuevo()` muestra `gestion.limite_cuadrillas` en la pestaña Cuadrillas
al llegar al tope (también en demo, donde no hay `/sync`). Orgs creadas antes del cambio
conservan el `planLimits.crews` guardado (1) — migración pendiente si aparecen usuarios
reales en free.

## Convenciones

- **Idioma**: tipos en inglés (`Worker`, `Shift`, `Entry`, `Rate`); funciones, variables y
  comentarios en español (`crearShift`, `persistir`, `sumarConteos`, `importeCentimos`).
- **Sin dependencias pesadas**: CSS propio con tokens (`app/src/styles/tokens.css`),
  gráficos en SVG/CSS a mano (nada de Chart.js). Únicas libs pesadas: `xlsx-js-style`
  (fork de SheetJS con estilos; import + export de Excel) y `jspdf` — **siempre con
  `import()` dinámico** (se cargan solo al importar/exportar). Fuera del precache del SW
  (`workbox.globIgnores` en `app/vite.config.ts`): `xlsx-js-style` (~870 KB) y las
  sub-deps de jspdf para `doc.html()`/SVG (`html2canvas`, `dompurify`, `canvg`) que no se
  usan. `jspdf` sí se precachea (PDF offline). Justifica cualquier dependencia nueva.
- **UI de campo**: objetivos táctiles ≥ 56 px (`--tap`), alto contraste, tema claro
  (uso a pleno sol). Modales = hojas inferiores (`.overlay` + `.hoja`). Las fichas
  editables (`EditSheet.svelte`) NO se cierran al tocar fuera y preguntan si hay cambios
  sin guardar.
- **i18n**: `i18n.t("clave", { var })`, locales en `app/src/lib/i18n/locales/`
  (`es/en/ro/ar/fr`, mismas claves en todos; `es` es el fallback si falta alguna).
  El idioma se elige en Cuenta (`SelectorIdioma.svelte`), se guarda en `meta.locale` y
  se aplica en `App.svelte` al arrancar (`i18n.cargar()` — usa el guardado o
  `navigator.language`). Árabe = RTL: `i18n.cambiar()` pone `document.documentElement.dir`.
  El CSS usa propiedades lógicas (`margin-inline-start`, `text-align: start`, …) y
  `[dir="rtl"]` solo voltea glifos direccionales (chevrones, flechas).
- **Datos demo** (`app/src/lib/dev/seed.ts`): solo en modo demo; se borran al hacer login
  real o `auth.salir()`. Se escriben SIN encolar en `pendingOps`.

## Tests

- `shared/tests/` — vitest plano sobre las funciones de dominio.
- `app/tests/` — `import "fake-indexeddb/auto"` para probar repos y stores. Los stores de
  runes (`*.svelte.ts`) funcionan gracias al plugin de svelte en `app/vitest.config.ts`.
- `api/tests/` — `mongodb-memory-server` (binario cacheado tras el primer `pnpm install`)
  + `supertest`. `fileParallelism: false`.

## Estado

MVP completo (8 pasos). Fuera del MVP, preparado pero no implementado: vista del
trabajador, NFC, fotos de albaranes. (i18n completo ro/ar/fr + selector de idioma + RTL
— hecho 2026-09-08.) El "panel de empresa" pasó a plan propio (ver abajo).

### Panel de empresa (propuesta acordada 2026-09-09, sin implementar)

**Encuadre.** Una organización = una empresa. Dentro, dos roles con herramientas
distintas:

- **Jefe de cuadrilla** (`foreman`): la PWA actual, móvil, **offline**. Crea datos en
  campo (partes, anotaciones, asistencia, alta "rápida" de trabajadores = nombre + alias
  + cuadrilla). No maneja economía (ya es así).
- **Gestor** (`gestor`, rol nuevo): **panel web nuevo**, escritorio, **online**. **No
  crea partes.** Consulta y completa: fichas laborales (altas), tarifas, liquidaciones
  (pagos), estadísticas, asistencia.
- `owner`: dueño, todos los permisos incluida la facturación.

El `plan` marca qué tiene la org: `foreman` = solo PWA (1 jefe, 2 cuadrillas, sin panel);
`company` = panel + varios jefes + varias cuadrillas.

**Arquitectura.**

- **Nuevo paquete `panel/`** — Vite + Svelte, SPA **online** (sin service worker, sin
  Dexie, sin motor de sync). Deploy aparte (`panel.cuadrillas.app`), misma API.
- Reutiliza `shared/` entero — `settlement.ts`, `rates.ts`, `stats.ts`, `attendance.ts`,
  `rgpd.ts` se guardaron para esto.
- **API nueva `/admin/*`** con middleware de rol (`owner`/`gestor`). Lee de las mismas
  colecciones Mongo que escribe `/sync`, con filtros, rangos de fecha y agregación. REST
  normal, nada de LWW.
- Auth: el mismo enlace mágico. El JWT ya lleva `role`; el panel solo admite
  `owner`/`gestor`, la PWA solo `foreman`/`owner`.
- Descartado: meter el panel como vistas gateadas por rol dentro de la PWA (el
  offline-first es lastre para una herramienta de consulta de escritorio).

**Decisiones de modelado (2026-09-09).**

1. Rol `gestor` **nuevo** (ya añadido a `Rol` en shared y al enum de `api/models/auth.ts`).
2. Datos laborales del trabajador: **set completo** — `Worker.laboral?: DatosLaborales`
   (`dni`, `numAfiliacionSS`, `iban`, `fechaAlta`, `fechaBaja`, `tipoContrato`,
   `categoria`), todo opcional, **solo se edita en el panel**, se borra al anonimizar
   (RGPD ampliado). Ya está el tipo en `shared/src/types/worker.ts`.
3. Liquidación **al vuelo** — el panel recalcula cada periodo al abrirlo (partes +
   tarifas + transporte). Sin entidad `Liquidacion` congelada por ahora.
4. **Invitaciones**: el gestor invita a un jefe por email → enlace mágico → `User` con
   rol `foreman` en la misma org. No existe aún.
5. `Organization.planLimits.foremen?` añadido (opcional); `LIMITES_POR_PLAN` en
   `api/src/lib/stripe.ts` ahora lleva `foremen` (free/foreman 1, company 25, campaign 3).

**Fases.**

- **A — Modelado**: hecho (decisiones arriba + tipos `Rol` / `Worker.laboral` /
  `planLimits.foremen` / enum de mongoose / `LIMITES_POR_PLAN.foremen` / RGPD).
- **B — Panel de consulta**: **scaffold hecho (2026-09-09)**.
  - API: `requiereRol(...roles)` en `middleware/auth.ts`; `services/adminService.ts`
    (consultas de solo lectura, `aWire`, filtradas por `organizationId`); `routes/admin.ts`
    (`GET /admin/resumen|cuadrillas|trabajadores|trabajadores/:id|partes|partes/:id`,
    todo gated a `owner`/`gestor`). Tests: `api/tests/admin.test.ts`.
  - `panel/`: `main.ts` + `App.svelte` (layout con barra lateral) + `lib/`
    (`config.ts` `API_URL`, `sesion.svelte.ts` login por enlace mágico con
    `localStorage`, `api.ts` fetch con bearer, `router.svelte.ts` hash router) +
    `routes/` (Login, Resumen, Cuadrillas, Trabajadores + ficha, Partes, ParteDetalle).
    Sin i18n (solo español por ahora). CSS propio en `src/app.css` (no reusa
    `tokens.css` — UX de escritorio distinta).
  - **Tarifas / asistencia / liquidación hechos (2026-09-09):** API `GET /admin/{productos,
    unidades}`, `GET/POST/PUT/DELETE /admin/tarifas` (zod; el POST/PUT hace upsert con
    `serverUpdatedAt` → el `/sync` del jefe recibe el cambio; DELETE = borrado lógico),
    `GET /admin/asistencia?anio&mes&crewId` (→ `asistenciaMensual`), `GET /admin/liquidacion
    ?desde&hasta&crewId` (→ `calcularLiquidacion`). Panel: vistas Tarifas (tabla + form),
    Asistencia (rejilla mes×trabajador), Liquidación (periodo + tabla). `panel/lib/api.ts`
    generalizado (método/body/params) + `panel/lib/money.ts`.
  - **Exports hechos (2026-09-09):** `panel/src/lib/export/` — `descargar.ts`
    (`<a download>`), `tabla.ts` (modelo `Tabla` genérico → `tablaACsv` / `tablaAXlsx`
    (`xlsx-js-style`) / `tablaAPdf` (`jspdf`), ambos lazy `import()`). Botones Excel/CSV en
    Asistencia y Excel/PDF/CSV en Liquidación. `panel/package.json` gana `jspdf` +
    `xlsx-js-style` (chunks aparte, solo se cargan al exportar).
  - Falta en la Fase B: **deploy** (`panel.cuadrillas.app`, `panel/wrangler.toml` listo,
    ver `DEPLOY.md` Fase 5 — acción de infra, no de código).
- **C — Altas**: **hecha (2026-09-10).**
  - `shared/domain/laboral.ts`: `CAMPOS_ALTA_MINIMOS` (dni, numAfiliacionSS, iban,
    fechaAlta), `estadoAlta(w)` (`pendiente` | `completa`), `faltanDatosAlta(w)`,
    `normalizarLaboral(datos)` (recorta strings, descarta vacíos, `undefined` si nada).
    Tests `shared/tests/laboral.test.ts`.
  - API `PUT /admin/trabajadores/:id/laboral` (zod `.strict()`, upsert con
    `serverUpdatedAt`; si queda vacío → `$unset laboral`). Tests en `api/tests/admin.test.ts`.
  - Panel: vista **"Altas"** (`Altas.svelte`, filtro pendientes/completas/todas +
    cuadrilla, tabla con estado y campos que faltan, edición inline) + componente
    reutilizable `panel/src/lib/FichaLaboral.svelte` (formulario de los 7 campos), usado
    también en la ficha de Trabajadores (ya editable, ya no read-only).
  - RGPD: `anonimizarWorker` ya borra `worker.laboral` (Fase A). Sin más ajustes.
- **D — Autoservicio / invitaciones: hecha (2026-09-10).**
  - `MagicToken` gana `inviteOrg` / `inviteRole` / `inviteCrewIds` (opcionales). Si
    `inviteOrg` está, `/auth/verify` llama a `altaInvitado` (une el usuario a esa org
    como `foreman`, lo mete en `Crew.foremanIds` de las cuadrillas dadas) en vez de
    `altaInicial` (que crea org+cuadrilla nuevas).
  - API (`/admin`, owner/gestor): `GET /equipo` (jefes + sus cuadrillas + invitaciones
    pendientes + `limite`/`ocupados`), `POST /invitaciones` `{email, crewIds?}` (gate por
    `planLimits.foremen`; 409 si el email ya tiene cuenta o ya hay invitación; email vía
    `enviarInvitacion`, 7 días), `DELETE /invitaciones/:token`, `PUT /jefes/:userId/
    cuadrillas` `{crewIds}` (fija en bloque qué cuadrillas lidera). Tests en
    `api/tests/admin.test.ts` (20 en total).
  - Panel: vista **"Equipo"** (`Equipo.svelte`): contador `ocupados/limite`, formulario de
    invitación (email + cuadrillas), lista de pendientes con revocar, lista de jefes con
    reasignación de cuadrillas inline. Si se llega al límite del plan → botón "Cambiar de
    plan" que llama a `POST /billing/checkout {plan:"company"}` y redirige a Stripe.
  - El "registro" de la empresa no necesita nada nuevo: `/auth/verify` ya crea una org
    `free` para un email nuevo; el owner sube a `company` desde el panel (o la PWA).
  - Límite: `LIMITES_POR_PLAN` — free/foreman 1 jefe, company 25, campaign 3. El owner
    siempre cuenta como 1 jefe.

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
implementada (2026-09-07, ver más abajo); la política tiene ya los datos del
responsable (Víctor José Tornet García, titular del proyecto Appstracta,
contact@appstracta.app).

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
  parte — sin arrastrar ausencias de otros días. **`stats.ts` también reparte las
  anotaciones de grupo** entre sus miembros (mismo criterio, 2026-09-08) — ya no las
  ignora.
  - **Un trabajador solo puede estar en un grupo (2026-09-08).** En `GroupForm.svelte`,
    los trabajadores que ya pertenecen a otro grupo **activo** salen con borde punteado,
    atenuados y con la nota "en {grupo}" (`gestion.grupo_ya_en`), y su checkbox
    deshabilitado (`toggle` también lo bloquea). Helper puro
    `shared/domain/groups.ts` → `gruposPorTrabajador(groups, exceptoId?)` (mapa
    workerId→nombre de grupo, ignora inactivos/borrados y el grupo que se edita).
    Test: `shared/tests/groups.test.ts`.
- **Firma del jefe al finalizar — hecho.** Al pulsar "Finalizar jornada" en
  `Registro.svelte` se abre `FirmaSheet.svelte`: aviso de cierre + un `<canvas>` táctil
  (Pointer Events, con `setPointerCapture` para no perder el trazo al salir del recuadro)
  y dos acciones, "Finalizar sin firmar" o "Firmar y finalizar" (deshabilitado hasta que
  hay trazo). La firma se guarda como PNG en data URL en `Shift.firma` (opcional;
  `jornada.cerrarActual(firma?)`), y se muestra de solo lectura en `ParteDetalle.svelte`
  (Historial). No se pidió ni se implementó en Liquidación (vista agregada por
  trabajador/periodo, sin hueco natural para una firma por parte individual). Firmar es
  opcional a propósito — un parte se puede cerrar sin firma sin fricción extra.
- **Hora de finalización del parte — hecho (2026-09-09).** Antes `jornada.cerrarActual`
  ponía `Shift.horaFin` a la hora del sistema en silencio (y `stats.ts` calculaba
  `horasDeJornada` = `horaFin - horaInicio` con ese dato inventado). Ahora `FirmaSheet`
  muestra un `<input type="time">` de **hora de finalización** (por defecto la hora
  actual, editable) + la hora de inicio como contexto; `cerrarActual(firma?, firmante?,
  horaFin?)` la guarda (si no es `HH:MM` válida, cae a la hora actual). El horario
  (`horaInicio – horaFin`, con `…` si el parte sigue abierto) se muestra ahora en
  `CabeceraParte.svelte` (Registro y Historial), en las filas del Historial, en el
  selector "Por jornada" de Estadísticas, y en los exports (`CabeceraInforme.horaInicio/
  horaFin` → `documento.ts` fila "Horario" + `textoAsistenciaParte` línea "Horario:").
  i18n `firma.hora_fin` / `firma.hora_inicio_info` / `cabecera.horario`. `Shift.horaFin`
  ya existía (sin cambio de modelo). Tests: `jornada.test.ts`, `documento.test.ts`.
- **Observaciones del parte — hecho (2026-09-09).** `Shift.observaciones?: string` (texto
  libre del jefe). Componente `ObservacionesParte.svelte` (textarea que guarda al perder
  el foco; modo `soloLectura` para consulta): en `Registro.svelte` (antes de "Finalizar
  jornada", `jornada.actualizarObservaciones`) y en `ParteDetalle.svelte` (solo lectura en
  consulta, editable en modo edición). Se propaga a **todos los derivados del parte**:
  `CabeceraInforme.observaciones` → `textoAsistenciaParte` (sección "Observaciones:" al
  final), `Documento.observaciones` → bloque de texto tras las tablas en el PDF (`pdf.ts`)
  y el Excel (`xlsx.ts`), en los dos informes (asistencia y parte). i18n
  `compartir.observaciones` / `registro.observaciones_ph`. Seed demo con una observación.
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
   (2026-09-07).** Datos del responsable rellenados en la política (2026-09-09). Enlace a
   la política también en Cuenta › Perfil (2026-09-09).
2. **Perfil del jefe de cuadrilla** (nombre, empresa, NIF, teléfono). **HECHO
   (2026-09-07).** Sección "Perfil" en Cuenta.
   - 2b. **Nombre del jefe junto a la firma** (`Shift.firmante?`). **HECHO (2026-09-07).**

**Pivote de producto: el jefe de cuadrilla no maneja economía** (decidido 2026-09-07)

3. **Eliminar la sección Liquidación.** **HECHO (2026-09-07).** Fuera: vista, menú,
   exports CSV/XLSX, pestaña "Tarifas". `settlement.ts` + `rates.ts` + tests se conservan.
4. **Tabla mensual de asistencia.** **HECHO (2026-09-07).** Vista `#/asistencia`.
5. **Compartir parte (asistencia + parte de trabajo) en texto/PDF/Excel.** **HECHO (2026-09-07).** Botón en `Registro`
   (parte activo) y `ParteDetalle` (Historial).

**Modelo de datos (base para el resto)** — necesitan conversación de modelado con el usuario

6. **Producto → separar "producto" y "variedad".** **HECHO (2026-09-07).** Dos campos
   en `Product` (`name` + `variedad?`), etiqueta "Naranja · Navelina".
7. **Auxiliares** (trabajadores que no cobran a destajo). **HECHO (2026-09-07).**
   `Worker.funcion` + sección aparte en el parte + tarea/horas por día.
8. **Cabecera del parte** (fecha, finca, producto·variedad, nº recolectores/auxiliares).
   **HECHO (2026-09-07).** `Shift.finca` + `CabeceraParte.svelte`. Fincas pasaron a
   entidad propia el 2026-09-09 (ver backlog).

**Mejoras rápidas e independientes**

9. **Aviso al finalizar si hay recolectores a 0.** **HECHO (2026-09-08).**
   `AvisoSinAnotarSheet` antes de `FirmaSheet`.
10. **Estadísticas por trabajador: integrar anotaciones de grupo.** **HECHO (2026-09-08).**
    `stats.ts` reparte las entradas de grupo entre sus miembros (como `settlement.ts`).

**Bloqueadas esperando decisión del usuario**

11. **Estructura de navegación** (más renombrados de menús / cambios de estructura).

**Pendientes nuevos (2026-09-09) — sin planificar**

14. **Trabajo por horas.** Añadir un modo alternativo al destajo: registrar el trabajo
    de un recolector por **horas** (no por unidades). Pendiente de conversación de
    modelado: ¿a nivel de parte (`Shift` "por unidades" | "por horas")?, ¿a nivel de
    trabajador?, ¿cómo se registra (una entrada de horas/día, similar a los
    auxiliares)?, ¿qué pasa con `stats.ts` (unidades/hora deja de tener sentido) y con
    la futura liquidación (jornal × horas)? Ver también "Auxiliares" (ya guardan
    tarea/horas por día) — puede que la infraestructura sirva.
15. **Apartado de instrucciones / ayuda.** Nueva pantalla (o sección en Cuenta) con
    instrucciones de uso de la app y un **botón de contacto** para dudas que abra un
    `mailto:contact@appstracta.app`. Definir: ¿pantalla propia en el menú?, ¿en varios
    idiomas o solo español al principio?, ¿texto largo tipo la política de privacidad o
    lista de pasos?

**Cuando toque cobrar de verdad**

12. **Pasar Stripe a modo live** (ver `DEPLOY.md`).

**Fuera de MVP (preparado, no implementado)**

13. **i18n completo (ro/ar/fr) + selector de idioma + RTL. HECHO (2026-09-08).** Queda:
    **panel de empresa** (propuesta acordada, ver "Panel de empresa" en `## Estado`) ·
    vista del trabajador · NFC · fotos de albaranes.
    - `i18n.svelte.ts`: `Locale = Idioma` (es/en/ro/ar/fr), `DICCIONARIOS` con los 5,
      `cargar()` (lee `meta.locale` o `navigator.language`), `cambiar()` (persiste +
      `document.documentElement.dir/lang`), getter `rtl`. `NOMBRE_IDIOMA` para el selector.
    - `locales/ro.json`, `ar.json`, `fr.json` (261 claves cada uno, traducción completa).
    - `SelectorIdioma.svelte` en Cuenta (autenticado y login). `App.svelte` llama
      `i18n.cargar()` antes de `auth.cargar()`.
    - RTL (árabe): CSS pasado a propiedades lógicas (`margin-inline-start`,
      `text-align: start/end`, `inset-inline-start`, `border-inline-end`); `[dir="rtl"]`
      voltea chevrones/flechas; `dir="ltr"` en los botones `+1/+5`.
    - Tests: `app/tests/i18n.test.ts` (incluye chequeo de paridad de claves).
    - Pulido (2026-09-09): números y fechas de calendario (nombre del mes en
      Asistencia, `num` en Estadísticas, `fmt` en `BarrasRanking`, último sync en
      Cuenta) ya usan `i18n.locale` en vez de `"es-ES"` fijo. Quedan los
      `localeCompare(..., "es")` de ordenación (cosmético, no se toca).

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
    lectura) y editables en edición; QR de un auxiliar se ignora. `CompartirParteSheet`
    / `textoAsistenciaParte` separan "Trabajadores" y "Auxiliares".
  - `stats.ts`: los auxiliares quedan **fuera** del ranking, medias y unidades/hora
    (`funcion === "auxiliar"`). `attendance.ts` (tabla mensual) los incluye y desde
    2026-09-09 **separa por rol**: `FilaAsistencia.funcion`, filas ordenadas
    recolectores→auxiliares, `AsistenciaMensual.totalPorDiaRol`.
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
  **Añadido 2026-09-09**: selector de cuadrilla (si hay >1), separación por rol
  (recolectores/auxiliares con subtotales), línea de fincas del mes
  (`AsistenciaMensual.fincas` / `fincasPorDia`, también en el `title` de cada celda),
  **export a Excel con estilo** (`asistenciaAXlsx`, además del CSV plano), y
  **distinción presente-y-anotó vs presente-sin-anotar**: `asistenciaMensual` recibe
  ahora `entries` (5º arg, opcional); `FilaAsistencia.conAnotacion[]` /
  `.sinAnotar` + `AsistenciaMensual.totalSinAnotar`. "Anotó" = registro propio,
  reparto de un grupo suyo, o `Shift.auxiliares` con tarea/horas. En pantalla la celda
  va rellena (anotó) o con aro + "·" (sin anotar), con leyenda; en el Excel verde vs
  ámbar y "X"/"·". El CSV sigue con "X" plano para cualquier presencia.
- **Compartir parte: texto + PDF + Excel — hecho (2026-09-07).** Botón "Compartir parte"
  en `Registro.svelte` (enlace bajo la cabecera, parte activo) y `ParteDetalle.svelte`
  (Historial, modo consulta). Abre `CompartirParteSheet.svelte` con **dos informes**:
  1. **Asistencia** (lista de trabajadores por rol): previsualización de texto +
     **Copiar** / **WhatsApp** (`wa.me/?text=`) / **Email** (`mailto:`) / **Compartir
     texto** (Web Share) + **PDF** + **Excel**.
  2. **Parte de trabajo** (cabecera + recolectores con unidades + auxiliares con
     tarea/horas + total + firma): **PDF** + **Excel**.
  - Dominio puro `shared/domain/parte.ts`: `informeAsistencia(cabecera, shift, workers)`,
    `informeParte(cabecera, shift, workers, entries)` (usa `sumarConteos`), `fechaES`.
  - **Los grupos NO se listan aparte en los informes (2026-09-08).** Ni tabla de grupos ni
    sección "Grupos:" en el texto. Los miembros aparecen en la lista de recolectores y
    `informeParte` reparte las unidades de cada grupo a partes iguales entre sus miembros
    presentes (mismo criterio que `settlement.ts` / `stats.ts`), redondeado a 1 decimal.
  - **Formato profesional (2026-09-08).** `app/src/lib/export/documento.ts` construye un
    modelo intermedio `Documento` (título · cabecera del parte como pares etiqueta/valor ·
    tablas con `columnas`/`filas`/`total`) desde el informe, y **tanto el PDF como el
    Excel renderizan ese mismo modelo**, así quedan idénticos: cabecera del parte en un
    recuadro/bloque gris con etiquetas en negrita, cabeceras de columna en negrita con
    fondo gris y centradas, bordes en todas las celdas con datos, fila de TOTAL en negrita
    con borde superior grueso. `pdf.ts` dibuja las tablas a mano (rect/line/text).
    `xlsx.ts` usa **`xlsx-js-style`** (fork de SheetJS con estilos de celda) — reemplaza a
    `xlsx` también en el import de trabajadores; ~870 KB, fuera del precache del SW
    (`vite.config.ts` globIgnores) y cargado con `import()`. i18n `compartir.numero/
    trabajador/grupo/miembros/tarea/horas/total`.
  - Los archivos se comparten/descargan con `compartirArchivo` (Web Share con `files`, o
    descarga). Nombre `asistencia_<cuadrilla>_<fecha>.pdf|xlsx` / `parte_...`.
  - **Previsualización (2026-09-09).** En cada sección de `CompartirParteSheet` un único
    botón **"Ver y exportar"** (`compartir.ver_exportar`) abre `PreviaDocumento.svelte`:
    renderiza el mismo modelo `Documento` como **HTML** (cabecera en tabla, tablas con fila
    de TOTAL, observaciones, firma) y desde ahí "PDF" / "Excel" generan el archivo real
    (`compartirArchivo`). Así se ve el contenido antes de enviar/descargar sin depender de
    un visor de PDF embebido. La previa no es pixel-idéntica al archivo (el PDF/Excel
    llevan el formato con bordes y sombreados); nota en `compartir.previa_nota`.
  - Tests: `shared/tests/parte.test.ts`, `app/tests/asistencia-parte.test.ts`,
    `app/tests/documento.test.ts`.
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
  - **Firma**: `Shift.firmante?: string`. `jornada.cerrarActual(firma?, firmante?, horaFin?)`.
    `FirmaSheet.svelte` muestra "Firma: {nombre}" si el perfil lo tiene; si no, un campo
    de texto para escribirlo esa vez (con aviso de guardarlo en Cuenta › Perfil).
    `ParteDetalle.svelte` lo pinta bajo la firma. Editar un parte cerrado no lo cambia.
  - Tests: `app/tests/perfil.test.ts`, casos nuevos en `app/tests/jornada.test.ts`.
  - **Exports (2026-09-09)**: `CabeceraInforme` lleva `empresa?` / `nif?`;
    `CompartirParteSheet` los rellena desde `perfil` (`Organization.name` / `taxId`) y
    `documento.ts` los pinta como primeras filas de la cabecera del PDF/Excel del parte.
    El informe RGPD (`informeATexto`) sigue sin datos del responsable — opcional, sin
    pedir.
- **Fincas como entidad — hecho (2026-09-09).** Antes `Shift.finca` era solo texto libre;
  ahora hay entidad **`Finca`** (`{ name, activo }`, sincronizada — en `ENTIDADES`,
  `tablaPorEntidad`, `Modelos`, Dexie **v3** `fincas: "id, organizationId"`). Pestaña
  "Fincas" en `Datos` (`FincaForm.svelte`, igual que Productos). Al comenzar un parte,
  `ComenzarJornadaSheet` muestra un **`<select>`** de fincas activas + opción "— Otra
  finca —" que revela un campo de texto; si se escribe una nueva se da de alta
  (`fincaPorNombreOAlta` en `db/repositories/fincas`, dedup por nombre) y el `Shift` sigue
  guardando el **nombre como texto** (snapshot, histórico estable). `fincasUsadas` se
  conserva (lo usa su test y el filtro del Historial deriva las fincas de los shifts).
  Seed demo: `Finca` "Finca El Naranjal". `auth.#limpiarDatosLocales` ahora también limpia
  `db.groups` y `db.fincas` (groups faltaba). Tests: caso de finca en
  `app/tests/gestion.test.ts`.
- **Historial: orden y filtros — hecho (2026-09-09).** `Historial.svelte`: botón de orden
  por fecha (recientes/antiguos primero) + `<select>` de cuadrilla, finca y producto
  (opciones derivadas de los partes cerrados que hay; el de cuadrilla/producto solo
  aparece si hay más de uno). "Quitar filtros" cuando hay alguno activo.
- **Compartir parte: claridad — hecho (2026-09-09).** Los dos informes van en tarjetas
  con borde (`.cmp-bloque`), cada una con título + texto de ayuda: **"Lista de
  asistencia"** (`compartir.asistencia` / `_ayuda`) y **"Parte de recolección"**
  (`compartir.parte` / `_ayuda`).
- **Tabla mensual de asistencia: Excel — hecho (2026-09-09).** `asistenciaAXlsx(tabla,
  {titulo, cuadrillas})` en `app/src/lib/export/asistencia.ts` (usa `xlsx-js-style` bajo
  demanda): título, fila de cuadrillas, cabecera de días en negrita/gris (fin de semana
  sombreado), "X" verde en asistencia, fila de totales con borde grueso. `Asistencia.svelte`
  ofrece **Excel** (primario) y **CSV** (secundario, sin cambios). i18n
  `asistencia.exportar_excel` / `exportar_csv`.
- **Cabecera del parte — hecho (2026-09-07).** `Shift.finca?: string`. Se elige al comenzar
  el parte en `ComenzarJornadaSheet` (ver "Fincas como entidad" arriba — antes era un
  `<datalist>` de texto libre, ahora un `<select>` de la entidad `Finca`). Componente
  `CabeceraParte.svelte`
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
  `Registro`/`ParteDetalle` (`CabeceraParte` + `CompartirParteSheet`),
  `Historial`. Form: `ProductForm.svelte` con campo "Producto" + "Variedad (opcional)"
  (i18n `gestion.producto_nombre` ahora "Producto", nueva `gestion.producto_variedad`).
  Migración: no hace falta — `variedad` es opcional, los `Product` sin ella se muestran a
  secas y sincronizan igual (`strict:false` en el servidor). Seed demo: Naranja ·
  Navelina. `settlement.ts`/`stats.ts` usan `productId` (id), no el nombre — sin cambios.
  Tests: `shared/tests/products.test.ts`, caso nuevo en `app/tests/gestion.test.ts`.
- **Aviso al finalizar si hay recolectores a 0 — hecho (2026-09-08).** Getter
  `jornada.sinAnotar`: nombres de los recolectores presentes con `conteoDe === 0` (o de
  los grupos con 0 si `trabajaPorGrupos`); los auxiliares no cuentan. En
  `Registro.svelte`, "Finalizar jornada" pasa por `intentarFinalizar()`: si
  `sinAnotar.length === 0` abre `FirmaSheet` directamente; si no, `AvisoSinAnotarSheet`
  (lista de nombres + "Volver a la lista" / "Finalizar de todas formas" → `FirmaSheet`).
  i18n `sin_anotar.*`. Test en `app/tests/jornada.test.ts`.
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
  - **Política de privacidad**: responsable = **Víctor José Tornet García**, titular del
    proyecto **Appstracta**, contacto `contact@appstracta.app` (rellenado 2026-09-09; sin
    dirección postal ni NIF por ser persona física y documento público). Texto en
    `Privacidad.svelte` (no i18n, es un documento). Encargados citados: MongoDB Atlas,
    Railway, Cloudflare, Resend, Stripe.
  - Tests: `shared/tests/rgpd.test.ts`, `app/tests/rgpd.test.ts`.
- **Estadísticas: anotaciones de grupo — hecho (2026-09-08).** `calcularEstadisticas`
  (`stats.ts`) reparte cada `Entry.groupId` a partes iguales (`cantidad / n`) entre los
  `memberIds` del snapshot de ESE parte, mismo criterio que `settlement.ts` (aquí las
  unidades pueden salir con decimales; `FilaTrabajador.unidades` y `totalUnidades` se
  redondean a 1 decimal, las medias usan el total sin redondear). `BarrasRanking` formatea
  con coma decimal. Tests en `shared/tests/stats.test.ts` (reparto entero y 100/3).
- Pasar Stripe a modo live cuando se quiera cobrar de verdad (ver `DEPLOY.md`).
