export type ResultadoCompartir = "compartido" | "descargado";

/**
 * Comparte un archivo con la Web Share API si el dispositivo lo permite
 * (movil); si no, lo descarga.
 */
export async function compartirArchivo(
  blob: Blob,
  nombre: string,
): Promise<ResultadoCompartir> {
  const archivo = new File([blob], nombre, { type: blob.type });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (nav.canShare?.({ files: [archivo] }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: [archivo], title: nombre });
      return "compartido";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return "compartido"; // el usuario cancelo
      }
      // cualquier otro fallo: caemos a descarga
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "descargado";
}

/** Nombre de archivo seguro a partir de texto libre. */
export function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "") // quita marcas de acento y no-ASCII
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "cuadrilla"
  );
}
