import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { entitlementFor } from "@/lib/context";
import { canUseModule } from "@/core/plans";
import { chunk } from "@/core/chat-agent/knowledge";
import { respond, type AgentConfig } from "@/core/chat-agent/agent";
import { parseInbound, sendText, verifyChallenge, verifySignature } from "@/core/chat-agent/whatsapp";

export async function GET(req: NextRequest) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const c = token ? verifyChallenge(req.nextUrl.searchParams, token) : null;
  return c ? new Response(c) : new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("bad signature", { status: 401 });
  const db = supabaseAdmin();
  for (const m of parseInbound(JSON.parse(raw))) {
    try {
      const { data: agent } = await db.from("chat_agents").select("workspace_id,config").eq("whatsapp_phone_number_id", m.phoneNumberId).maybeSingle();
      if (!agent || m.type !== "text" || !m.text) continue; // multimedia: pendiente
      const ws = agent.workspace_id as string; const ent = await entitlementFor(ws);
      if (!canUseModule(ent, "chat-agent").allowed) continue;
      const { data: dup } = await db.from("chat_messages").select("id").eq("wa_message_id", m.id).maybeSingle(); if (dup) continue; // idempotencia ante reintentos de Meta
      const { data: contact } = await db.from("chat_contacts").upsert({ workspace_id: ws, wa_id: m.from, name: m.name }, { onConflict: "workspace_id,wa_id" }).select("id,opted_out").single();
      if (!contact) continue;
      await db.from("chat_messages").insert({ workspace_id: ws, contact_id: contact.id, direction: "in", body: m.text, wa_message_id: m.id });
      if (contact.opted_out) continue; // nunca responder a quien pidió baja
      const [{ data: docs }, { data: hist }] = await Promise.all([
        db.from("chat_docs").select("id,title,text").eq("workspace_id", ws),
        db.from("chat_messages").select("direction,body").eq("contact_id", contact.id).order("id", { ascending: false }).limit(10),
      ]);
      const history = (hist ?? []).reverse().map((h) => ({ role: h.direction === "in" ? "user" as const : "agent" as const, text: h.body }));
      const d = await respond(agent.config as AgentConfig, chunk(docs ?? []), history.slice(0, -1), m.text, ent, {
        recordUsage: async ({ provider, credits }) => { await db.from("usage_ledger").insert({ workspace_id: ws, module_id: "chat-agent", provider, units: credits, kind: "ai.reply" }); },
      });
      if (d.optOut) await db.from("chat_contacts").update({ opted_out: true }).eq("id", contact.id);
      const token = process.env.WHATSAPP_TOKEN;
      if (d.reply && token) await sendText({ token, phoneNumberId: m.phoneNumberId, to: m.from, body: d.reply });
      await db.from("chat_messages").insert({ workspace_id: ws, contact_id: contact.id, direction: "out", body: d.reply ?? "", status: d.handoff ? "needs_human" : "ok", reason: d.reason, sources: d.sources });
    } catch (e) {
      await db.from("audit_log").insert({ action: "chat.webhook_error", detail: { error: e instanceof Error ? e.message : String(e) } });
    }
  }
  return NextResponse.json({ ok: true }); // siempre 200 para evitar tormenta de reintentos de Meta
}
