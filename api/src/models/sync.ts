import { Schema, model, type Model } from "mongoose";
import type { EntityName } from "@cuadrilla/shared";

/**
 * Campos de control comunes. El resto de campos de cada entidad se guardan sin
 * esquema (`strict: false`): la forma se valida en la capa de sync.
 *
 * - `updatedAt`: epoch ms del cliente. Base de la politica LWW.
 * - `serverUpdatedAt`: lo pone el servidor en cada escritura. Es el cursor del
 *   pull (`changes` = docs con `serverUpdatedAt > lastSyncAt`).
 */
export interface DocBase {
  _id: string;
  organizationId: string;
  updatedAt: number;
  serverUpdatedAt: Date;
  deleted: boolean;
  [campo: string]: unknown;
}

function crearModelo(coleccion: string): Model<DocBase> {
  const schema = new Schema<DocBase>(
    {
      _id: { type: String, required: true },
      organizationId: { type: String, required: true, index: true },
      updatedAt: { type: Number, required: true },
      serverUpdatedAt: { type: Date, required: true, index: true },
      deleted: { type: Boolean, default: false },
    },
    { strict: false, versionKey: false, _id: false },
  );
  return model<DocBase>(coleccion, schema, coleccion);
}

export const Modelos: Record<EntityName, Model<DocBase>> = {
  organization: crearModelo("organizations"),
  crew: crearModelo("crews"),
  worker: crearModelo("workers"),
  group: crearModelo("groups"),
  finca: crearModelo("fincas"),
  product: crearModelo("products"),
  unitType: crearModelo("unitTypes"),
  rate: crearModelo("rates"),
  shift: crearModelo("shifts"),
  entry: crearModelo("entries"),
};
