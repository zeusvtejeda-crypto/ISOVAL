"use client";
import { useActionState } from "react";
import { simulate } from "./actions";

export function Simulator() {
  const [s, run, pending] = useActionState(simulate, undefined);
  const c = "mt-1 w-full rounded border border-current/30 bg-transparent px-3 py-2";
  return (
    <form action={run} className="mt-4 max-w-xl space-y-3">
      <label className="block text-sm">Nombre del negocio<input name="businessName" required className={c} /></label>
      <label className="block text-sm">Personalidad<input name="persona" className={c} placeholder="Amable, breve, tutea al cliente" /></label>
      <label className="block text-sm">Conocimiento (servicios, precios, horarios, políticas). Lo que no esté aquí, el agente no lo afirmará.<textarea name="knowledge" required rows={6} className={c} /></label>
      <label className="block text-sm">Mensaje del cliente<input name="message" required className={c} /></label>
      <button disabled={pending} className="rounded bg-current/90 px-4 py-2 font-medium text-[var(--background)] disabled:opacity-50">{pending ? "Probando…" : "Probar"}</button>
      {s && <div role="status" className="rounded border border-current/20 p-3 text-sm"><p className="text-xs uppercase opacity-60">Simulación — no se envió nada por WhatsApp</p>
        {s.error ? <p className="text-red-500">{s.error}</p> : <><p className="mt-1">{s.reply}</p><p className="mt-2 opacity-70">{s.handoff ? "↪ Transferiría a humano" : "✓ Respondería"} · motivo: {s.reason}{s.sources?.length ? ` · fuentes: ${s.sources.join(", ")}` : ""}</p></>}</div>}
    </form>
  );
}
