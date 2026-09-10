# Despliegue

Plan por fases. Cada fase deja algo usable; no hace falta completar todas para
empezar a probar con un jefe de cuadrilla de verdad.

- Repo: https://github.com/vtornet/cuadrillas
- Dominio propio: `cuadrillas.app`, comprado en Namecheap
  - PWA (jefe de cuadrilla) → `https://cuadrillas.app` (Cloudflare Workers con
    assets estáticos — la cuenta usa el sistema "Workers Builds" que sustituye a
    Pages, ver nota en fase 1)
  - API → `https://api.cuadrillas.app` (Railway)
  - Panel de empresa → `https://panel.cuadrillas.app` (Cloudflare Workers,
    proyecto aparte — **pendiente de crear**, ver fase 5)

## Fase 1 — PWA en modo demo (sin backend)

No necesita ninguna de las cuentas de abajo salvo Cloudflare.

1. **Cloudflare Pages** → *Create a project* → *Connect to Git* → repo `vtornet/cuadrillas`.
2. Build settings:
   - Root directory: `/` (raíz del monorepo — Cloudflare necesita ver el
     `pnpm-workspace.yaml` para resolver `@cuadrilla/shared`).
   - Build command: `pnpm --filter @cuadrilla/app build`
   - Build output directory: `app/dist`
   - Cloudflare detecta `pnpm` solo por el campo `packageManager` del
     `package.json` raíz; no hace falta configurar nada más.
3. Variable de entorno de build: deja `VITE_API_URL` **sin definir** por ahora
   (modo demo). Cuando exista la API, se añade con el valor
   `https://api.cuadrillas.app` y se vuelve a desplegar.
4. Dominio (`cuadrillas.app` comprado en **Namecheap** → hay que traer el DNS a
   Cloudflare primero, luego enlazarlo al Worker). Pasos reales verificados
   (2026-09-04, el panel de Cloudflare cambia bastante entre cuentas/fechas):
   1. Cloudflare → busca **"Add a domain"** en la home de la cuenta → escribe
      `cuadrillas.app` → plan **Free** → continúa. Te da **2 nameservers**
      (`algo.ns.cloudflare.com`).
   2. Namecheap → *Domain List* → **Manage** sobre `cuadrillas.app` → sección
      **Nameservers** → cambia de "Namecheap BasicDNS" a **Custom DNS** → pega los
      2 nameservers de Cloudflare → guarda (✓).
   3. Espera a que la zona pase a activa (email de Cloudflare, o entra en la
      zona y comprueba que ya NO sale el aviso amarillo de "pending"). Minutos a
      pocas horas.
   4. **Limpia el DNS**: un dominio recién comprado en Namecheap trae por
      defecto una "parking page". En la zona → **DNS → Records**, borra (Edit →
      Delete):
      - `cuadrillas.app` tipo **A** (apunta a una IP de Namecheap)
      - `www.cuadrillas.app` tipo **CNAME** → `parkingpage.namecheap.com`

      No toques los registros `MX`/`TXT` (`eforward*.registrar-servers.com`,
      `v=spf1...`) — son el reenvío de correo gratuito de Namecheap.
   5. Cuelga el dominio del Worker: **Workers & Pages → `cuadrillas`** (el
      proyecto) → pestaña **Domains** (arriba, junto a Overview/Metrics/
      Deployments...) → **Add Domain** → en el cuadro "Connect domain" busca y
      selecciona `cuadrillas.app` → en "Enter your subdomain" **déjalo vacío**
      (para la raíz, sin subdominio) → confirma. Cloudflare crea el registro DNS
      y el certificado SSL solo (1-2 min).

   ⚠️ Si ya tenías email u otra cosa apuntando a `cuadrillas.app` en Namecheap,
   comprueba en el paso 1 que Cloudflare lo importó antes de cambiar los
   nameservers.

> Tu cuenta usa el sistema nuevo de Cloudflare ("Workers Builds", que sustituye a
> Pages): el deploy corre `wrangler deploy`, no `wrangler pages deploy`. Por eso el
> `wrangler.toml` de la raíz usa `[assets] directory = "app/dist"` (Worker de solo
> estáticos) en vez de `pages_build_output_dir` (que es de la sintaxis antigua de
> Pages y `wrangler deploy` no reconoce). Sin una config válida, Wrangler intenta
> "adivinar" la app y eso es lo que falla en la raíz de un monorepo pnpm.

Con esto, `https://cuadrillas.app` ya es instalable en el móvil y funciona 100%
offline con datos de ejemplo — sin tocar Railway, Mongo ni Stripe.

## Fase 2 — Backend (Railway + MongoDB Atlas)

1. **MongoDB Atlas**: crea un cluster free (M0). *Database Access* → usuario y
   contraseña. *Network Access* → permite `0.0.0.0/0` (Railway no tiene IP fija)
   o los rangos de Railway si prefieres restringirlo. Copia el connection
   string (`mongodb+srv://...`).
2. **Railway** → *New Project* → *Deploy from GitHub repo* → `vtornet/cuadrillas`.
   **Root Directory: déjalo en `/`** (la raíz del monorepo, igual que en
   Cloudflare) — el `api/railway.json` ya define el build/start command
   (`pnpm --filter @cuadrilla/api build` / `start`), que necesita ver el
   `pnpm-workspace.yaml` para resolver `@cuadrilla/shared`.

   > **Fallo visto (2026-09-08):** build "failed during the build process — The
   > configured root directory was not found in the deployed source". Es
   > **config del servicio, no del código**: el campo *Settings → Source → Root
   > Directory* apuntaba a una ruta inexistente (o se había reseteado). Solución:
   > ponerlo en `/` (o activarlo y dejarlo en `/`) y volver a desplegar.
3. Variables en Railway (Settings → Variables):
   - `MONGODB_URI` = el connection string de Atlas (con el nombre de BD, p. ej.
     `.../cuadrilla?retryWrites=true&w=majority`)
   - `JWT_SECRET` = una cadena aleatoria larga (`openssl rand -hex 32`)
   - `APP_URL` = `https://cuadrillas.app`
   - `PORT` la inyecta Railway solo.
4. *Settings → Networking → Custom Domain* → `api.cuadrillas.app`, y añade el
   CNAME que te indique en el DNS de tu dominio.
5. Comprueba `https://api.cuadrillas.app/health` → `{"ok":true}`.
6. En Cloudflare Pages, añade `VITE_API_URL=https://api.cuadrillas.app` y
   vuelve a desplegar la PWA (*Retry deployment* o un commit nuevo).

A partir de aquí el login por enlace mágico funciona, pero el enlace solo se ve
en los **logs de Railway** (no se envía email todavía) — sirve para probar tú
mismo, no para usuarios reales.

## Fase 3 — Email real (Resend)

1. Cuenta en Resend, verifica el dominio `cuadrillas.app` (registros DNS que te
   da Resend: SPF/DKIM).
2. Railway: añade `RESEND_API_KEY` y `EMAIL_FROM=Cuadrillas <login@cuadrillas.app>`.

## Fase 4 — Stripe (modo test primero)

1. Cuenta Stripe → crea 3 productos/precios: jefe de cuadrilla (suscripción
   mensual), empresa (suscripción mensual), campaña (pago único). Copia los
   `price_...`.
2. Railway: `STRIPE_SECRET_KEY` (clave **test** primero),
   `STRIPE_PRICE_FOREMAN`, `STRIPE_PRICE_COMPANY`, `STRIPE_PRICE_CAMPAIGN`.
3. Stripe Dashboard → *Developers → Webhooks* → endpoint
   `https://api.cuadrillas.app/webhooks/stripe`, eventos
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copia el signing secret a
   `STRIPE_WEBHOOK_SECRET` en Railway.
4. Prueba un pago con tarjeta de test (`4242 4242 4242 4242`). Cuando funcione,
   repite el paso 2-3 con las claves **live**.

## Fase 5 — Panel de empresa (`panel/`)

Paquete `panel/` — SPA **online** (sin service worker, sin IndexedDB), habla con
la misma API. Roles `owner` / `gestor` (JWT). Endpoints `/admin/*`. La API ya
sirve `/admin` y el CORS ya es `*` → **no hace falta tocar Railway**.

### Estado del código: completo (Fases A–D, 2026-09-10)

Todo implementado, con tests (157 en total). Solo falta **crear el proyecto en
Cloudflare** (acción de dashboard, ~5 clics).

| Área | Estado |
|---|---|
| Rol `gestor`, `Worker.laboral`, `planLimits.foremen` | ✅ (shared + api) |
| API `/admin`: resumen, cuadrillas, trabajadores (+ficha), partes (+detalle) | ✅ |
| API `/admin`: productos/unidades, **tarifas (CRUD)** | ✅ |
| API `/admin`: **asistencia mensual**, **liquidación por periodo** | ✅ (usa `asistenciaMensual` / `calcularLiquidacion` de `shared`) |
| API `/admin`: **altas** (`PUT .../laboral`) | ✅ |
| API `/admin`: **equipo/invitaciones** (`/equipo`, `POST/DELETE /invitaciones`, `PUT /jefes/:id/cuadrillas`) | ✅ |
| `/auth/verify`: aceptar invitación (une a org existente como `foreman`) | ✅ |
| Panel: login (enlace mágico, solo `owner`/`gestor`), 9 vistas | ✅ |
| Panel: exports Excel/CSV/PDF (`panel/src/lib/export/`) | ✅ (liquidación y asistencia) |
| Panel: gate de plan + botón "cambiar a Empresa" → `/billing/checkout` | ✅ |
| Deploy en `panel.cuadrillas.app` | ❌ **pendiente (dashboard)** |
| i18n del panel | ❌ solo español (aceptable: los gestores son de oficina) |

### Dev local

`pnpm dev:api` (necesita un Mongo: `docker run -p 27017:27017 mongo:7`) +
`pnpm dev:panel` → panel en `localhost:5175`, apunta al API en `:8080`.

### Desplegar (Cloudflare, mismo sistema "Workers Builds" que la PWA)

Es un **proyecto de Cloudflare NUEVO**, distinto del de la PWA (`cuadrillas`).

1. Cloudflare → *Workers & Pages* → **Create** → **Import a repository** (o
   "Connect to Git") → repo `vtornet/cuadrillas` → nombre del proyecto:
   `cuadrillas-panel`.
2. Build settings:
   - **Root directory**: `/` (raíz del monorepo — pnpm necesita el
     `pnpm-workspace.yaml` para resolver `@cuadrilla/shared`).
   - **Build command**: `pnpm --filter @cuadrilla/panel build`
   - **Deploy command / Wrangler config**: si te deja indicar el archivo de
     configuración de Wrangler, pon `panel/wrangler.toml` (ahí
     `[assets] directory = "dist"` → `panel/dist`, nombre del Worker
     `cuadrillas-panel`). Si NO te deja: pon **Build output directory** =
     `panel/dist` y **borra `panel/wrangler.toml`** (para que `wrangler deploy`
     no lo confunda con el de la raíz — o renómbralo a `panel/wrangler.jsonc`
     y ajusta).
3. **Variables y secretos → Variables de build**:
   `VITE_API_URL = https://api.cuadrillas.app`
   (sin ella el panel intenta `http://localhost:8080` y no conecta).
4. Lanza el primer deploy. Sale en `cuadrillas-panel.<tu-subdominio>.workers.dev`.
5. **Dominio** `panel.cuadrillas.app`: en el proyecto → pestaña **Domains** →
   **Add** → subdominio `panel`. Cloudflare crea el registro DNS y el SSL solo
   (la zona `cuadrillas.app` ya está en tu cuenta desde la Fase 1).
6. A partir de aquí, cada `git push` a `main` redespliega solo (igual que la
   PWA y la API).

### Qué necesito para hacerlo yo

No puedo tocar tu cuenta de Cloudflare. Dos vías:

- **Recomendada — tú creas el proyecto** (pasos 1–5 de arriba, una vez). Luego
  yo ya no hago falta para el panel: los cambios van solos con `git push`.
- **Deploy manual por CLI** (yo, si me das acceso): necesito un
  **`CLOUDFLARE_API_TOKEN`** con permiso *Account → Workers Scripts → Edit* (y
  *Zone → Workers Routes → Edit* si además quiero enganchar el dominio) y el
  **`CLOUDFLARE_ACCOUNT_ID`**. Con eso corro:
  ```bash
  VITE_API_URL=https://api.cuadrillas.app pnpm --filter @cuadrilla/panel build
  cd panel && pnpm dlx wrangler@latest deploy   # usa panel/wrangler.toml
  ```
  Eso publica el Worker `cuadrillas-panel` y te da el `*.workers.dev`. El
  dominio `panel.cuadrillas.app` sigue necesitando el paso 5 (dashboard) o el
  permiso de Zone. Pásame el token por un canal privado (no lo pegues aquí);
  ponlo en un `.env` fuera del repo o como variable de entorno de la sesión.

  > Nota: el deploy manual NO deja el proyecto conectado a Git. Para que los
  > `git push` sigan redesplegando solos hace falta igualmente el paso 1.

## Pendiente antes de usuarios reales

La pantalla RGPD (política de privacidad + exportación/anonimización de los datos
de un trabajador) ya está implementada (2026-09-07). Antes de dar de alta a un jefe
de cuadrilla real hay que **rellenar en `app/src/routes/Privacidad.svelte` los datos
de Appstracta**: dirección postal, CIF/NIF y correo de contacto para privacidad
(los marcadores `[…]`).
