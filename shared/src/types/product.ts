import type { RegistroSincronizable } from "./base";

export interface Product extends RegistroSincronizable {
  name: string;
  activo: 0 | 1;
}
