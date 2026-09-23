/** Descarga un texto como archivo desde el navegador (sin servidor). */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
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
