import type { SiteSpec } from "./spec";

export type Finding = { level: "error" | "warn"; code: string; message: string };

const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/** Auditoría estática de SEO/accesibilidad sobre la especificación (no mide rendimiento real). */
export function audit(spec: SiteSpec): Finding[] {
  const f: Finding[] = [];
  if (spec.description.length < 50) f.push({ level: "warn", code: "seo.description_short", message: "La meta descripción debería tener 50–160 caracteres." });
  if (spec.description.length > 160) f.push({ level: "warn", code: "seo.description_long", message: "Meta descripción >160 caracteres: se truncará." });
  if (spec.sections.filter((s) => s.type === "hero").length !== 1) f.push({ level: "error", code: "seo.h1", message: "Debe haber exactamente un hero (un solo h1)." });
  if (contrast(spec.theme.text, spec.theme.background) < 4.5) f.push({ level: "error", code: "a11y.contrast_text", message: "Contraste texto/fondo < 4.5:1." });
  if (contrast(spec.theme.background, spec.theme.primary) < 4.5) f.push({ level: "error", code: "a11y.contrast_btn", message: "Contraste botón/fondo < 4.5:1." });
  for (const s of spec.sections) {
    if (s.type === "hero" && s.image && !s.image.alt.trim()) f.push({ level: "error", code: "a11y.alt", message: "Imagen del hero sin texto alternativo." });
    if (s.type === "contact" && s.form && !s.email) f.push({ level: "warn", code: "form.no_email", message: "El formulario no se renderiza sin correo de destino." });
  }
  return f;
}
