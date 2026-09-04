import mongoose from "mongoose";
import { env } from "./env";

export async function conectarMongo(uri: string = env.mongoUri): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function desconectarMongo(): Promise<void> {
  await mongoose.disconnect();
}
