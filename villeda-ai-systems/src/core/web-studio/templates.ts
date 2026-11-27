import { siteSchema, type SiteSpec } from "./spec";

/** Plantillas con marcadores explícitos «[…]»: el usuario debe reemplazarlos; no contienen datos inventados. */
const T = (name: string, theme: SiteSpec["theme"], sections: unknown[]) => siteSchema.parse({ name, description: "[Describe tu negocio en 50–160 caracteres]", theme, sections });
export const TEMPLATES: Record<string, { label: string; spec: SiteSpec }> = {
  servicios: { label: "Servicios profesionales", spec: T("[Nombre]", { primary: "#1d4ed8", background: "#ffffff", text: "#111827", font: "system" }, [
    { type: "hero", title: "[Propuesta de valor]", subtitle: "[Qué haces y para quién]", cta: { label: "Contáctanos", href: "#contacto" } },
    { type: "features", title: "Por qué elegirnos", items: [{ title: "[Beneficio 1]", text: "[…]" }, { title: "[Beneficio 2]", text: "[…]" }] },
    { type: "contact", title: "Contacto", form: true }]) },
  tienda: { label: "Catálogo / tienda", spec: T("[Nombre]", { primary: "#047857", background: "#fafaf9", text: "#1c1917", font: "serif" }, [
    { type: "hero", title: "[Título]", cta: { label: "Ver catálogo", href: "#catalogo" } },
    { type: "catalog", title: "Catálogo", items: [{ name: "[Producto]", description: "[…]", price: "[Precio]" }] },
    { type: "contact", title: "Pedidos", form: true }]) },
  portafolio: { label: "Portafolio personal", spec: T("[Tu nombre]", { primary: "#7c3aed", background: "#0f172a", text: "#f8fafc", font: "system" }, [
    { type: "hero", title: "[Tu nombre y especialidad]" },
    { type: "text", title: "Sobre mí", body: "[Tu historia]" },
    { type: "contact", title: "Hablemos", form: true }]) },
};
export const placeholders = (spec: SiteSpec) => (JSON.stringify(spec).match(/\[[^\]"]+\]/g) ?? []).length;
