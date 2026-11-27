import { describe, it, expect, vi } from "vitest";
import { siteSchema, type SiteSpec } from "./spec";
import { renderSite } from "./render";
import { audit, contrast } from "./audit";
import { save, restore } from "./versions";
import { generateSite } from "./generate";

const spec: SiteSpec = siteSchema.parse({
  name: "Mi Negocio <x>", description: "Descripción de prueba suficientemente larga para pasar la auditoría de SEO básica.",
  theme: { primary: "#1d4ed8", background: "#ffffff", text: "#111111" },
  sections: [
    { type: "hero", title: "Hola", cta: { label: "Contacto", href: "#c" } },
    { type: "catalog", title: "Servicios", items: [{ name: "A<script>", price: "$100" }] },
    { type: "contact", title: "Contacto", email: "a@b.co", whatsapp: "5211234567890", form: true },
  ],
});

describe("render", () => {
  const html = renderSite(spec);
  it("escapa HTML", () => { expect(html).not.toContain("<script>"); expect(html).toContain("A&lt;script&gt;"); });
  it("semántica: un h1, lang, viewport, meta description", () => {
    expect(html.match(/<h1/g)).toHaveLength(1); expect(html).toContain('lang="es"'); expect(html).toContain("viewport"); expect(html).toContain('name="description"');
  });
  it("whatsapp y formulario", () => { expect(html).toContain("https://wa.me/5211234567890"); expect(html).toContain("<form"); });
});
describe("spec", () => {
  it("rechaza javascript: en enlaces", () => {
    expect(siteSchema.safeParse({ ...spec, sections: [{ type: "hero", title: "x", cta: { label: "y", href: "javascript:alert(1)" } }] }).success).toBe(false);
  });
  it("rechaza color inválido", () => expect(siteSchema.safeParse({ ...spec, theme: { ...spec.theme, primary: "red" } }).success).toBe(false));
});
describe("audit", () => {
  it("sitio válido sin errores", () => expect(audit(spec).filter((f) => f.level === "error")).toEqual([]));
  it("detecta bajo contraste", () => expect(audit({ ...spec, theme: { ...spec.theme, text: "#cccccc" } }).map((f) => f.code)).toContain("a11y.contrast_text"));
  it("contraste negro/blanco = 21", () => expect(Math.round(contrast("#000000", "#ffffff"))).toBe(21));
});
describe("versions", () => {
  it("restaurar crea nueva versión sin borrar historia", () => {
    let h = save([], spec, "v1"); h = save(h, { ...spec, name: "Otro" }, "v2"); h = restore(h, 1);
    expect(h.map((v) => v.n)).toEqual([1, 2, 3]); expect(h[2].spec.name).toBe(spec.name); expect(h[2].note).toBe("Restaurada v1");
  });
  it("versión inexistente falla", () => expect(() => restore([], 9)).toThrow());
});
describe("generateSite (IA simulada)", () => {
  const ent = { plan: "business" as const, modules: ["web-studio" as const], creditsUsed: 0 };
  const mk = (...texts: string[]) => { let i = 0; return vi.fn(async () => new Response(JSON.stringify({ content: [{ text: texts[Math.min(i++, texts.length - 1)] }], usage: { input_tokens: 10, output_tokens: 10 } }))) as unknown as typeof fetch; };
  it("acepta JSON válido", async () => {
    const r = await generateSite({ description: "x" }, ent, { env: { ANTHROPIC_API_KEY: "k" }, fetchFn: mk("```json\n" + JSON.stringify(spec) + "\n```") });
    expect(r.name).toBe(spec.name);
  });
  it("reintenta tras salida inválida", async () => {
    const f = mk("no es json", JSON.stringify(spec));
    await generateSite({ description: "x" }, ent, { env: { ANTHROPIC_API_KEY: "k" }, fetchFn: f });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("falla si el modelo nunca valida", async () => {
    await expect(generateSite({ description: "x" }, ent, { env: { ANTHROPIC_API_KEY: "k" }, fetchFn: mk("basura") })).rejects.toThrow("especificación válida");
  });
});
