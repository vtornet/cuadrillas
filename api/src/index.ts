import { crearApp } from "./app";
import { conectarMongo } from "./config/db";
import { env } from "./config/env";

async function main(): Promise<void> {
  await conectarMongo();
  crearApp().listen(env.port, () => {
    console.log(`API de Cuadrilla en http://localhost:${env.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
