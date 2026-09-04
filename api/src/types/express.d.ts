import type { TokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export {};
