"use client";
import { useActionState } from "react";
import { createProject } from "./actions";

export function NewProject() {
  const [s, run, pending] = useActionState(createProject, undefined);
  const c = "mt-1 w-full rounded border border-current/30 bg-transparent px-3 py-2";
  return (
    <form action={run} className="mt-4 max-w-xl space-y-3">
      <label className="block text-sm">Nombre del proyecto<input name="name" required className={c} /></label>
      <label className="block text-sm">Describe el negocio o proyecto<textarea name="description" required rows={4} className={c} /></label>
      <label className="block text-sm">Datos verificados (dirección, teléfono, precios…). Lo que no escribas aquí no se inventará.<textarea name="facts" rows={3} className={c} /></label>
      {s?.error && <p role="alert" className="text-sm text-red-500">{s.error}</p>}
      <button disabled={pending} className="rounded bg-current/90 px-4 py-2 font-medium text-[var(--background)] disabled:opacity-50">{pending ? "Generando… (puede tardar)" : "Generar sitio"}</button>
    </form>
  );
}
