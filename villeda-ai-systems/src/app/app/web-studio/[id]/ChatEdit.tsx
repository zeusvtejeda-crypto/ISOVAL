"use client";
import { useActionState } from "react";
import { editWithChat } from "../actions";

export function ChatEdit({ id }: { id: string }) {
  const [s, run, pending] = useActionState(editWithChat.bind(null, id), undefined);
  return (
    <form action={run} className="space-y-2">
      <label className="block font-semibold" htmlFor="ins">Editar con instrucciones</label>
      <textarea id="ins" name="instruction" rows={3} required placeholder="Ej.: cambia el color principal a verde y mueve Contacto arriba" className="w-full rounded border border-current/30 bg-transparent px-2 py-1" />
      {s?.error && <p role="alert" className="text-red-500">{s.error}</p>}{s?.ok && <p role="status" className="text-green-600">{s.ok}</p>}
      <button disabled={pending} className="rounded bg-current/90 px-3 py-1.5 text-[var(--background)] disabled:opacity-50">{pending ? "Aplicando…" : "Aplicar"}</button>
    </form>
  );
}
