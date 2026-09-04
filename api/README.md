# @cuadrilla/api

Backend de Cuadrillas: Express + MongoDB (Mongoose). Autenticacion por enlace
magico y endpoint `/sync`.

## Endpoints

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/health` | Comprobacion de vida. |
| `POST` | `/auth/magic-link` | `{ email }` -> crea un token de 15 min y lo envia por email (o lo escribe en consola si no hay `RESEND_API_KEY`). En desarrollo devuelve `{ enlace }`. |
| `POST` | `/auth/verify` | `{ token }` -> canjea el token por un JWT (365 d). Primer acceso de un email: crea organizacion + cuadrilla + usuario `owner`. |
| `POST` | `/sync` | *(JWT)* `{ lastSyncAt, ops }` -> aplica las operaciones con politica LWW y limites de plan; devuelve `{ serverTime, changes, applied, rejected }`. |
| `POST` | `/billing/checkout` | *(JWT)* `{ plan }` -> URL de Stripe Checkout. `503` si Stripe no esta configurado. |
| `POST` | `/billing/portal` | *(JWT)* -> URL del portal de cliente de Stripe (facturas, cancelar). |
| `POST` | `/webhooks/stripe` | Eventos de Stripe (cuerpo raw + firma). Actualiza `plan`, `planLimits`, `stripeCustomerId`, `subscriptionStatus` de la organizacion. |

## Sincronizacion

- **LWW por registro**: se compara `updatedAt` (epoch ms del cliente). En empate
  gana el entrante. Logica compartida en `@cuadrilla/shared/domain` (`entranteGana`).
- **Cursor de pull**: cada escritura en servidor pone `serverUpdatedAt` (Date).
  `changes` = documentos con `serverUpdatedAt > lastSyncAt`. Nunca depende del
  reloj del cliente.
- **Multi-tenant**: `organizationId` se fuerza al del token en cada upsert; las
  consultas solo devuelven documentos de esa organizacion.
- **Limites de plan gratuito** (1 cuadrilla, 10 trabajadores): las altas que los
  superan se devuelven en `rejected` y el cliente las revierte.

## Local

```bash
cp .env.example .env          # ajusta MONGODB_URI y JWT_SECRET
pnpm --filter @cuadrilla/api dev
```

Necesitas un MongoDB local (o Docker: `docker run -p 27017:27017 mongo:7`).

## Despliegue en Railway

1. Servicio nuevo apuntando a este repo. Root directory: `/` (raiz del monorepo).
   `railway.json` (en `api/`) define build y start.
2. Anade el plugin **MongoDB** y copia su `MONGO_URL` a la variable `MONGODB_URI`.
3. Variables: `JWT_SECRET`, `APP_URL` (URL de la PWA), y opcional
   `RESEND_API_KEY` + `EMAIL_FROM` para enviar emails de verdad.
4. `PORT` lo inyecta Railway.

## Stripe

1. Crea 3 productos/precios en Stripe: jefe (suscripcion), empresa (suscripcion),
   campana (pago unico). Pon sus `price_...` en `STRIPE_PRICE_FOREMAN/COMPANY/CAMPAIGN`.
2. `STRIPE_SECRET_KEY` (clave secreta).
3. Crea un endpoint de webhook -> `https://TU-API/webhooks/stripe`, eventos
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copia su secreto a `STRIPE_WEBHOOK_SECRET`.
4. Local: `stripe listen --forward-to localhost:8080/webhooks/stripe`.

El plan y sus limites (`planLimits`) viven en el documento `Organization`, que es
una entidad sincronizada: el cliente recibe el plan actualizado en el siguiente
`/sync`.
