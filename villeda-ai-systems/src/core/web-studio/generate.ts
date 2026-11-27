import { generate, type GatewayDeps } from "../ai/gateway";
import type { Entitlement } from "../plans";
import { siteSchema, type SiteSpec } from "./spec";

export type Brief = { description: string; facts?: Record<string, string>; lang?: "es" | "en" };

const SYSTEM = `Eres un generador de especificaciones de sitios web. Responde SOLO un JSON válido con: name, lang, description(<=160), theme{primary,background,text (hex #RRGGBB, contraste alto),font(system|serif|mono)}, sections[] con types: hero{title,subtitle,cta{label,href},image?}, features{title,items[{title,text}]}, text{title?,body}, catalog{title,items[{name,description?,price?}]}, contact{title,email?,phone?,whatsapp?,address?,mapUrl?,form}.
REGLAS: usa únicamente datos del brief. NO inventes reseñas, certificaciones, precios, fotos, direcciones, teléfonos ni correos; si falta un dato, omite el campo.`;

/** Pide al modelo un sitio, valida con zod y reintenta una vez con el error. Nunca devuelve JSON sin validar. */
export async function generateSite(b: Brief, ent: Entitlement, deps?: GatewayDeps): Promise<SiteSpec> {
  const prompt = `Idioma: ${b.lang ?? "es"}\nDescripción: ${b.description}\nDatos verificados: ${JSON.stringify(b.facts ?? {})}`;
  let err = "";
  for (let i = 0; i < 2; i++) {
    const r = await generate({ system: SYSTEM, prompt: prompt + (err ? `\nEl intento anterior falló la validación: ${err}` : ""), maxTokens: 4000 }, ent, deps);
    try {
      const json = r.text.match(/\{[\s\S]*\}/)?.[0] ?? "";
      return siteSchema.parse(JSON.parse(json));
    } catch (e) { err = e instanceof Error ? e.message.slice(0, 500) : "JSON inválido"; }
  }
  throw new Error(`El modelo no produjo una especificación válida: ${err}`);
}
