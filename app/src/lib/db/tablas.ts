import type { Table } from "dexie";
import type { EntityName, RegistroSincronizable } from "@cuadrilla/shared";
import { db } from "./dexie";

/** Tabla Dexie generica por nombre de entidad. */
export function tablaPorEntidad(
  e: EntityName,
): Table<RegistroSincronizable, string> {
  switch (e) {
    case "organization":
      return db.organizations as never;
    case "crew":
      return db.crews as never;
    case "worker":
      return db.workers as never;
    case "product":
      return db.products as never;
    case "unitType":
      return db.unitTypes as never;
    case "rate":
      return db.rates as never;
    case "shift":
      return db.shifts as never;
    case "entry":
      return db.entries as never;
  }
}
