import type { SyncRequest, SyncResponse } from "@cuadrilla/shared";
import { API_URL } from "../config";

export class SyncAuthError extends Error {}

export async function postSync(
  token: string,
  body: SyncRequest,
): Promise<SyncResponse> {
  const r = await fetch(`${API_URL}/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (r.status === 401) throw new SyncAuthError("sesion caducada");
  if (!r.ok) throw new Error(`sync respondio ${r.status}`);
  return r.json();
}
