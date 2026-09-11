import mongoose from "mongoose";
import { env } from "./env";

export async function conectarMongo(uri: string = env.mongoUri): Promise<void> {
  // false (el valor por defecto desde Mongoose 7): las consultas pueden
  // filtrar por campos que NO están en el schema. Los modelos de entidad
  // (`models/sync.ts`) son `strict: false` a propósito — la forma real de
  // cada entidad se valida en `syncService`, no en Mongo — así que consultas
  // como `{ foremanIds: userId }` o `{ crewId }` deben llegar tal cual.
  // Con `strictQuery: true` (como estaba) Mongoose las descarta en silencio
  // y la consulta se queda solo con los campos declarados: un bug real que
  // hacía, por ejemplo, que el pull de /sync no filtrara por cuadrilla.
  mongoose.set("strictQuery", false);
  await mongoose.connect(uri);
}

export async function desconectarMongo(): Promise<void> {
  await mongoose.disconnect();
}
