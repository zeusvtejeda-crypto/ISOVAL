"use server";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canUseModule } from "@/core/plans";
import { chunk } from "@/core/chat-agent/knowledge";
import { respond, DEFAULT_OPT_OUT, type AgentConfig } from "@/core/chat-agent/agent";

export type Sim = { reply?: string; handoff?: boolean; reason?: string; sources?: string[]; error?: string; simulated: true };
const in_ = z.object({ businessName: z.string().min(1).max(80), persona: z.string().max(1000), knowledge: z.string().min(1).max(20000), message: z.string().min(1).max(1000) });

/** SIMULADOR: usa IA real si hay clave, pero no toca WhatsApp ni guarda mensajes de clientes. Cuenta como consumo. */
export async function simulate(_: Sim | undefined, fd: FormData): Promise<Sim> {
  const p = in_.safeParse(Object.fromEntries(fd)); if (!p.success) return { error: p.error.issues[0].message, simulated: true };
  const ctx = await getContext();
  if (!ctx) return { error: "Supabase no configurado", simulated: true };
  if (!canUseModule(ctx.ent, "chat-agent").allowed) return { error: "Módulo no contratado", simulated: true };
  const cfg: AgentConfig = { businessName: p.data.businessName, persona: p.data.persona, language: "es", humanHandoffMessage: "Te paso con una persona del equipo para ayudarte mejor.", optOutKeywords: DEFAULT_OPT_OUT };
  const kb = chunk([{ id: "sim", title: "Conocimiento", text: p.data.knowledge }]);
  const d = await respond(cfg, kb, [], p.data.message, ctx.ent, { recordUsage: async ({ provider, credits }) => { await supabaseAdmin().from("usage_ledger").insert({ workspace_id: ctx.workspaceId, module_id: "chat-agent", provider, units: credits, kind: "ai.simulate" }); } });
  return { reply: d.reply ?? undefined, handoff: d.handoff, reason: d.reason, sources: d.sources, simulated: true };
}
