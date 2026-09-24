/** Guardado de archivos que ofrece el visor de artefactos de claude.ai (allí un <a download> no hace nada). */
interface HostDownloads {
  save(request: { filename: string; data: string }): Promise<unknown>;
}

interface HostRuntime {
  use(name: 'downloads'): Promise<HostDownloads | null>;
}

function hostRuntime(): HostRuntime | null {
  const claude = (window as unknown as { claude?: Partial<HostRuntime> }).claude;
  return typeof claude?.use === 'function' ? (claude as HostRuntime) : null;
}

function browserDownload(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Algunos navegadores leen la URL después del clic: se libera un poco más tarde.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Descarga un texto como archivo desde el navegador (sin servidor). Dentro del visor de claude.ai usa
 * su diálogo de guardado. Rechaza si el archivo no se pudo ofrecer o la persona lo canceló.
 */
export async function downloadTextFile(filename: string, text: string, mime = 'application/json'): Promise<void> {
  const host = hostRuntime();
  if (host) {
    const downloads = await host.use('downloads');
    if (downloads) {
      await downloads.save({ filename, data: text });
      return;
    }
  }
  browserDownload(filename, text, mime);
}
