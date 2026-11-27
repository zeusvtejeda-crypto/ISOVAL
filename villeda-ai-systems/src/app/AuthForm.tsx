"use client";
import { useActionState } from "react";
import type { FormState } from "./actions";

type Field = { name: string; label: string; type: string; autoComplete?: string };
export function AuthForm({ action, fields, submit }: { action: (s: FormState, f: FormData) => Promise<FormState>; fields: Field[]; submit: string }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="mt-6 space-y-4">
      {fields.map((f) => (
        <label key={f.name} className="block text-sm">{f.label}
          <input name={f.name} type={f.type} autoComplete={f.autoComplete} required className="mt-1 w-full rounded border border-current/30 bg-transparent px-3 py-2" />
        </label>
      ))}
      {state?.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-green-600">{state.ok}</p>}
      <button disabled={pending} className="w-full rounded bg-current/90 px-3 py-2 font-medium text-[var(--background)] disabled:opacity-50">{pending ? "Procesando…" : submit}</button>
    </form>
  );
}
