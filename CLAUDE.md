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

3. **Eliminar la sección Liquidación** (vista, entrada de menú, exports CSV/XLSX de
   liquidación). La lógica de dominio `settlement.ts` se **conserva** para un futuro rol
   gestor/owner; solo desaparece del cliente del jefe.
4. **Tabla mensual de asistencia** — nueva vista que ocupa el hueco de Liquidación:
   trabajadores en filas × días del mes en columnas, celdas coloreadas por asistencia.
5. **Enviar asistencia desde un parte** — una vez creado un parte, opción de generar la
   lista de trabajadores incluidos y enviarla (WhatsApp / email / compartir).

**Modelo de datos (base para el resto)** — necesitan conversación de modelado con el usuario

6. **Producto → separar "producto" y "variedad".** Bloquea la cabecera del parte; toca
   `ComenzarJornadaSheet`, `stats.ts`, `settlement.ts`, exports.
7. **Auxiliares** (trabajadores que no cobran a destajo). Bloquea "total auxiliares" y el
   reparto en liquidación.
8. **Cabecera del parte** (fecha, finca, producto, variedad, totales). Depende de 6, 7 y
   de un modelo nuevo de finca/variedad.

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

- **Auxiliares.** Además de los recolectores (que cobran a destajo por unidad), en muchas
  cuadrillas hay personas que hacen otras tareas: carga de camiones, paletizado de cajas
  en campo, pesaje de cajas (berries), etc. No cobran por recolección. Habría que poder
  darlos de alta y reflejar su trabajo/pago de forma distinta al destajo por unidad
  (¿jornal fijo? ¿por horas? ¿tarifa aparte?) — pendiente de definir el modelo con el
  usuario.
- **Estructura de navegación.** Primer lote de renombrados de menús ya aplicado (ver
  arriba: "Iniciar parte", "Datos"). Quedan pendientes más cambios de nombres/estructura
  que el usuario irá explicando.
- **Eliminar la sección Liquidación (2026-09-07).** El jefe de cuadrilla **no maneja
  datos económicos**. Quitar del cliente: vista `app/src/routes/Liquidacion.svelte`, la
  entrada `"liquidacion"` en `router.svelte.ts` (`Vista` + `VISTAS`) y en `MenuSheet`,
  los exports de liquidación (`app/src/lib/export/csv.ts` y `xlsx.ts` en la parte de
  liquidación, `compartir.ts` se reutiliza). La lógica de dominio `shared/src/domain/
  settlement.ts` y sus tests **se conservan** (sirven para un futuro rol gestor/owner o
  un panel de empresa). Revisar que `Estadisticas.svelte` no muestre importes (hoy usa
  `stats.ts`, que es de unidades/horas, no dinero — confirmar). `Rate`/tarifas: decidir
  si el jefe sigue viéndolas en "Datos" (probablemente sí, para que las unidades tengan
  sentido) o también se ocultan.
- **Tabla mensual de asistencia (2026-09-07).** Nueva vista (ocupa el hueco que deja
  Liquidación en el menú). Tabla: **filas = trabajadores**, **columnas = días del mes**,
  cada celda coloreada según si ese trabajador tuvo asistencia ese día. Fuente:
  `Shift.attendeeIds` + `Shift.fecha` de los partes del mes (± registros `Entry` si se
  quiere distinguir "presente pero sin anotaciones"). Selector de mes. Pensar export
  (XLSX/CSV) y cómo se ve en móvil (scroll horizontal con primera columna fija). Sin
  datos económicos.
- **Enviar asistencia desde un parte (2026-09-07).** Una vez creado un parte (en
  `Registro.svelte` con parte activo, y/o en `ParteDetalle.svelte`), botón "Enviar
  asistencia" → genera una lista legible de los trabajadores incluidos en ese parte
  (nombre, y quizá cuadrilla/grupo y fecha) → opción de enviar por **WhatsApp**
  (`https://wa.me/?text=...`), **email** (`mailto:?body=...`) o compartir del sistema
  (Web Share API, ya usada en `app/src/lib/export/compartir.ts`). Texto plano; sin
  importes.
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
- **Cabecera del parte.** Cada parte debería mostrar (en pantalla y en el detalle /
  exports) una cabecera con: **fecha, finca, producto, variedad, total recolectores,
  total auxiliares**, etc. Estado actual (`shared/src/types/shift.ts`): `Shift` ya tiene
  `fecha`, `productId`, `crewId`, `attendeeIds`, `groups?`; **faltan** `finca` y
  `variedad` (¿campos libres en el parte? ¿entidades propias, tipo "Finca" con sus
  variedades, elegibles al comenzar la jornada en `ComenzarJornadaSheet`?). "Total
  recolectores" y "total auxiliares" salen de contar la asistencia por rol una vez exista
  la distinción recolector/auxiliar (ver punto **Auxiliares** arriba). Sitio natural para
  pintarla: cabecera de `Registro.svelte` (parte activo), `ParteDetalle.svelte`
  (Historial) y las cabeceras de los exports de liquidación/estadísticas. Pendiente de
  concretar el modelo de finca/variedad con el usuario.
- **Producto: separar "producto" y "variedad".** Hoy `Product` es solo `{ name, activo }`
  (`shared/src/types/product.ts`, form en `gestion/ProductForm.svelte`, clave i18n
  `gestion.producto_nombre`). Debe pasar a tener **campo de producto** (p. ej. "Naranja")
  **y campo de variedad** (p. ej. "Navelina"), además de lo ya existente. A decidir:
  ¿dos campos en el mismo `Product` (`producto` + `variedad`, `name` pasa a derivado
  "Naranja · Navelina"), o "producto" y "variedad" como entidades separadas? Afecta a
  todo lo que hoy muestra `product.name`: `ComenzarJornadaSheet`, `Registro.svelte`
  (`registro.jornada_info`), `stats.ts`, `settlement.ts`, exports CSV/XLSX y la cabecera
  del parte de arriba. Migración: los `Product` actuales quedan con `variedad` vacía.
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
