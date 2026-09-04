# Despliegue

Plan por fases. Cada fase deja algo usable; no hace falta completar todas para
empezar a probar con un jefe de cuadrilla de verdad.

- Repo: https://github.com/vtornet/cuadrillas
- Dominio propio: `cuadrillas.app`
  - PWA → `https://cuadrillas.app` (Cloudflare Pages)
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
4. Dominio: *Custom domains* → añade `cuadrillas.app` (y `www.cuadrillas.app` si
   quieres redirigir). Cloudflare gestiona el certificado solo.

Con esto, `https://cuadrillas.app` ya es instalable en el móvil y funciona 100%
offline con datos de ejemplo — sin tocar Railway, Mongo ni Stripe.

## Fase 2 — Backend (Railway + MongoDB Atlas)

1. **MongoDB Atlas**: crea un cluster free (M0). *Database Access* → usuario y
   contraseña. *Network Access* → permite `0.0.0.0/0` (Railway no tiene IP fija)
   o los rangos de Railway si prefieres restringirlo. Copia el connection
   string (`mongodb+srv://...`).
2. **Railway** → *New Project* → *Deploy from GitHub repo* → `vtornet/cuadrillas`.
   Usa el `api/railway.json` ya presente en el repo (build/start commands).
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
2. Railway: añade `RESEND_API_KEY` y `EMAIL_FROM=Cuadrilla <login@cuadrillas.app>`.

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

## Pendiente antes de usuarios reales

La pantalla RGPD (política de privacidad + exportación/borrado de los datos de
un trabajador) todavía no está implementada — conviene tenerla antes de dar de
alta a un jefe de cuadrilla real (fase 2 en adelante).
