import { z } from "zod";
import { generate, type GatewayDeps } from "../ai/gateway";
import type { Entitlement } from "../plans";
import { sectionSchema, siteSchema, type SiteSpec } from "./spec";

export const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_theme"), theme: siteSchema.shape.theme.partial() }),
  z.object({ op: z.literal("set_meta"), name: z.string().min(1).optional(), description: z.string().max(200).optional() }),
  z.object({ op: z.literal("update_section"), index: z.number().int().min(0), section: sectionSchema }),
  z.object({ op: z.literal("add_section"), index: z.number().int().min(0).optional(), section: sectionSchema }),
  z.object({ op: z.literal("remove_section"), index: z.number().int().min(0) }),
  z.object({ op: z.literal("move_section"), from: z.number().int().min(0), to: z.number().int().min(0) }),
]);
export type Op = z.infer<typeof opSchema>;

/** Aplica operaciones sin mutar; revalida el sitio completo (nunca deja un spec inválido). */
export function applyOps(spec: SiteSpec, ops: Op[]): SiteSpec {
  let s = structuredClone(spec);
  for (const o of ops) {
    const n = s.sections.length;
    switch (o.op) {
      case "set_theme": s.theme = { ...s.theme, ...o.theme }; break;
      case "set_meta": s = { ...s, name: o.name ?? s.name, description: o.description ?? s.description }; break;
      case "update_section": if (o.index >= n) throw new Error("Índice fuera de rango"); s.sections[o.index] = o.section; break;
      case "add_section": s.sections.splice(Math.min(o.index ?? n, n), 0, o.section); break;
      case "remove_section": if (o.index >= n) throw new Error("Índice fuera de rango"); s.sections.splice(o.index, 1); break;
      case "move_section": if (o.from >= n || o.to >= n) throw new Error("Índice fuera de rango"); s.sections.splice(o.to, 0, ...s.sections.splice(o.from, 1)); break;
    }
  }
  return siteSchema.parse(s);
}

const SYS = `Traduces instrucciones de edición de un sitio a un arreglo JSON de operaciones. Operaciones: set_theme{theme}, set_meta{name?,description?}, update_section{index,section}, add_section{index?,section}, remove_section{index}, move_section{from,to}. Responde SOLO el arreglo JSON. No inventes datos del negocio (precios, teléfonos, reseñas, certificaciones).`;

/** Edición por lenguaje natural: la IA propone operaciones, el código las valida y aplica. */
export async function chatEdit(spec: SiteSpec, instruction: string, ent: Entitlement, deps?: GatewayDeps): Promise<SiteSpec> {
  const r = await generate({ system: SYS, prompt: `Sitio actual:\n${JSON.stringify(spec)}\n\nInstrucción: ${instruction}`, maxTokens: 3000 }, ent, deps);
  const raw = r.text.match(/\[[\s\S]*\]/)?.[0];
  if (!raw) throw new Error("La IA no devolvió operaciones");
  return applyOps(spec, z.array(opSchema).max(20).parse(JSON.parse(raw)));
}
