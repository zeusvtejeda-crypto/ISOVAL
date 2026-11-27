import { Suspense } from "react";
import { getContext } from "@/lib/context";
import { canUseModule } from "@/core/plans";
import { Simulator } from "./Simulator";

export default function Page() { return <Suspense fallback={<p role="status">Cargando…</p>}><ChatAgent /></Suspense>; }

async function ChatAgent() {
  const ctx = await getContext();
  if (!ctx) return <p role="alert" className="rounded border border-yellow-500/50 p-4 text-sm">Supabase no configurado (ver .env.example).</p>;
  if (!canUseModule(ctx.ent, "chat-agent").allowed) return <p role="alert" className="rounded border border-current/30 p-4 text-sm">Chat Agent no está contratado en este espacio.</p>;
  return (<><h1 className="text-2xl font-bold">Chat Agent</h1><p className="text-sm opacity-70">Webhook de WhatsApp: <code>/api/webhooks/whatsapp</code> (requiere WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_TOKEN).</p>
    <h2 className="mt-6 font-semibold">Simulador</h2><Simulator /></>);
}
