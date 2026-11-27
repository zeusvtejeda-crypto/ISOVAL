import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MODULES, MODULE_IDS, isModuleId } from "@/core/modules";
import { canUseModule } from "@/core/plans";
import { getContext } from "@/lib/context";

export function generateStaticParams() { return MODULE_IDS.map((module) => ({ module })); }

export default function Page({ params }: { params: Promise<{ module: string }> }) {
  return <Suspense fallback={<p role="status">Cargando…</p>}><ModulePage params={params} /></Suspense>;
}

async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!isModuleId(module)) notFound();
  const m = MODULES[module];
  const ctx = await getContext();
  const head = <><h1 className="text-2xl font-bold">{m.name}</h1><p className="opacity-70">{m.tagline.es}</p></>;
  if (!ctx) return <>{head}<p role="alert" className="mt-6 rounded border border-yellow-500/50 p-4 text-sm">Supabase no está configurado: sin autenticación no se puede verificar el acceso. Ver <code>.env.example</code>.</p></>;
  const d = canUseModule(ctx.ent, module);
  if (!d.allowed) return <>{head}<p role="alert" className="mt-6 rounded border border-current/30 p-4 text-sm">Este módulo no está contratado en tu espacio «{ctx.workspaceName}».</p></>;
  return <>{head}<p className="mt-6 rounded border border-current/20 p-4 text-sm">Estado: <b>{m.status}</b> · Fase {m.phase}.</p></>;
}
