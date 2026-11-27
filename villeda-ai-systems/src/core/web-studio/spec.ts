import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const url = z.string().refine((v) => /^(https?:\/\/|\/|#|mailto:|tel:)/.test(v), "URL no permitida"); // bloquea javascript:

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), title: z.string().min(1), subtitle: z.string().optional(), cta: z.object({ label: z.string(), href: url }).optional(), image: z.object({ src: url, alt: z.string() }).optional() }),
  z.object({ type: z.literal("features"), title: z.string(), items: z.array(z.object({ title: z.string(), text: z.string() })).min(1) }),
  z.object({ type: z.literal("text"), title: z.string().optional(), body: z.string() }),
  z.object({ type: z.literal("catalog"), title: z.string(), items: z.array(z.object({ name: z.string(), description: z.string().optional(), price: z.string().optional() })) }), // precios SOLO los que aporta el usuario
  z.object({ type: z.literal("contact"), title: z.string(), email: z.string().email().optional(), phone: z.string().optional(), whatsapp: z.string().regex(/^\d{8,15}$/).optional(), address: z.string().optional(), mapUrl: url.optional(), form: z.boolean().default(true) }),
]);

export const siteSchema = z.object({
  name: z.string().min(1),
  lang: z.enum(["es", "en"]).default("es"),
  description: z.string().max(200),
  theme: z.object({ primary: hex, background: hex, text: hex, font: z.enum(["system", "serif", "mono"]).default("system") }),
  sections: z.array(sectionSchema).min(1),
});
export type SiteSpec = z.infer<typeof siteSchema>;
export type Section = z.infer<typeof sectionSchema>;
