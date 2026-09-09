# Despliegue

Plan por fases. Cada fase deja algo usable; no hace falta completar todas para
empezar a probar con un jefe de cuadrilla de verdad.

- Repo: https://github.com/vtornet/cuadrillas
- Dominio propio: `cuadrillas.app`, comprado en Namecheap
  - PWA → `https://cuadrillas.app` (Cloudflare Workers con assets estáticos —
    la cuenta usa el sistema "Workers Builds" que sustituye a Pages, ver nota
    en fase 1)
  - API → `https://api.cuadrillas.app` (Railway)

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

## Fase 5 — Panel de empresa (`panel/`, en marcha 2026-09-09)

Paquete `panel/` — SPA **online** (sin service worker, sin IndexedDB), habla con
la misma API. Roles `owner` / `gestor` (JWT). Endpoints `/admin/*`.

1. **Cloudflare Pages/Workers**: nuevo proyecto apuntando a `panel/` (build
   `pnpm --filter @cuadrilla/panel build`, salida `panel/dist`).
2. Dominio `panel.cuadrillas.app` (CNAME en Cloudflare).
3. Variable de build `VITE_API_URL=https://api.cuadrillas.app`.
4. La API ya sirve `/admin` — no hace falta tocar Railway (CORS ya es `*`).
5. Dev local: `pnpm dev:api` + `pnpm dev:panel` (panel en :5175, API en :8080).

Estado: Fase B (panel de consulta: resumen, cuadrillas, trabajadores, partes).
Faltan tarifas (CRUD), liquidación por periodo, altas (Fase C) e invitaciones
(Fase D). Ver `CLAUDE.md` > "Panel de empresa".

## Pendiente antes de usuarios reales

La pantalla RGPD (política de privacidad + exportación/anonimización de los datos
de un trabajador) ya está implementada (2026-09-07). Antes de dar de alta a un jefe
de cuadrilla real hay que **rellenar en `app/src/routes/Privacidad.svelte` los datos
de Appstracta**: dirección postal, CIF/NIF y correo de contacto para privacidad
(los marcadores `[…]`).
