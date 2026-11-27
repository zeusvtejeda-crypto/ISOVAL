import { z } from "zod";
import { generate, type GatewayDeps } from "../ai/gateway";
import type { Entitlement } from "../plans";
import { search, tokens, type Chunk } from "./knowledge";

export type AgentConfig = {
  businessName: string; persona: string; language: "es" | "en";
  hours?: { tz: string; days: number[]; from: string; to: string }; // days 0=domingo
  humanHandoffMessage: string; optOutKeywords: string[];
};
export type Turn = { role: "user" | "agent"; text: string };
export type Decision = {
  reply: string | null; handoff: boolean; reason: "ok" | "opt_out" | "no_knowledge" | "ungrounded_figure" | "model_requested" | "bad_model_output" | "ai_unavailable";
  intent?: string; sources: string[]; optOut?: boolean;
};

export const DEFAULT_OPT_OUT = ["stop", "baja", "no más", "no mas", "cancelar suscripcion", "unsubscribe"];
const out = z.object({ reply: z.string().min(1), intent: z.string().default("other"), handoff: z.boolean().default(false), sources: z.array(z.string()).default([]) });

const figures = (s: string) => (s.match(/\$\s?\d[\d,.]*|\d[\d,.]*\s?(?:mxn|usd|pesos|dólares|dolares)|\b\d{1,2}:\d{2}\b/gi) ?? []).map((x) => x.toLowerCase().replace(/[\s,]/g, ""));

/** Garantía dura: toda cifra (precio u hora) en la respuesta debe aparecer en el conocimiento recuperado. */
export const ungroundedFigures = (reply: string, ctx: Chunk[]) => {
  const known = figures(ctx.map((c) => c.text).join(" "));
  return figures(reply).filter((f) => !known.includes(f));
};

export function respond(cfg: AgentConfig, kb: Chunk[], history: Turn[], msg: string, ent: Entitlement, deps?: GatewayDeps): Promise<Decision> {
  return (async (): Promise<Decision> => {
    const low = msg.trim().toLowerCase();
    if (cfg.optOutKeywords.some((k) => low === k || tokens(low).join(" ") === tokens(k).join(" "))) return { reply: cfg.language === "es" ? "Listo, no volverás a recibir mensajes nuestros." : "Done, you won't receive more messages.", handoff: false, reason: "opt_out", optOut: true, sources: [] };
    const hits = search(kb, msg, 4);
    if (!hits.length) return { reply: cfg.humanHandoffMessage, handoff: true, reason: "no_knowledge", sources: [] };
    const system = `Eres el asistente de ${cfg.businessName}. ${cfg.persona}\nIdioma: ${cfg.language}. Eres un asistente automatizado; dilo si te lo preguntan.\nREGLAS: responde SOLO con la información de CONOCIMIENTO. Si no basta, responde con handoff=true. NUNCA inventes precios, horarios, disponibilidad, descuentos ni confirmaciones de citas/pedidos. Para agendar o confirmar algo, usa handoff=true.\nResponde SOLO JSON: {"reply":string,"intent":string,"handoff":boolean,"sources":[títulos usados]}`;
    const prompt = `CONOCIMIENTO:\n${hits.map((h) => `[${h.title}]\n${h.text}`).join("\n---\n")}\n\nCONVERSACIÓN:\n${history.slice(-8).map((t) => `${t.role === "user" ? "Cliente" : "Agente"}: ${t.text}`).join("\n")}\nCliente: ${msg}`;
    let parsed;
    try {
      const r = await generate({ system, prompt, maxTokens: 600 }, ent, deps);
      parsed = out.parse(JSON.parse(r.text.match(/\{[\s\S]*\}/)?.[0] ?? ""));
    } catch (e) {
      const name = e instanceof Error ? e.constructor.name : "";
      const unavailable = ["ProviderNotConfigured", "CreditsExhausted"].includes(name);
      return { reply: cfg.humanHandoffMessage, handoff: true, reason: unavailable ? "ai_unavailable" : "bad_model_output", sources: [] };
    }
    if (parsed.handoff) return { reply: cfg.humanHandoffMessage, handoff: true, reason: "model_requested", intent: parsed.intent, sources: parsed.sources };
    if (ungroundedFigures(parsed.reply, hits).length) return { reply: cfg.humanHandoffMessage, handoff: true, reason: "ungrounded_figure", intent: parsed.intent, sources: [] };
    return { reply: parsed.reply, handoff: false, reason: "ok", intent: parsed.intent, sources: parsed.sources };
  })();
}

/** ¿Está abierto ahora? Calcula en la zona horaria del negocio. */
export function isOpen(h: NonNullable<AgentConfig["hours"]>, now = new Date()): boolean {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: h.tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday"));
  const hm = `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
  return h.days.includes(day) && hm >= h.from && hm < h.to;
}
