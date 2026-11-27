import { Suspense } from "react";
import Link from "next/link";
import { getContext } from "@/lib/context";
import { supabaseServer } from "@/lib/supabase/server";
import { canUseModule } from "@/core/plans";
import { NewProject } from "./NewProject";
import { createFromTemplate } from "./actions";
import { TEMPLATES } from "@/core/web-studio/templates";

export default function Page() {
  return <Suspense fallback={<p role="status">Cargando…</p>}><WebStudio /></Suspense>;
}

async function WebStudio() {
  const ctx = await getContext();
  if (!ctx) return <p role="alert" className="rounded border border-yellow-500/50 p-4 text-sm">Supabase no configurado (ver .env.example).</p>;
  if (!canUseModule(ctx.ent, "web-studio").allowed) return <p role="alert" className="rounded border border-current/30 p-4 text-sm">Web Studio no está contratado en este espacio.</p>;
  const { data: projects } = await (await supabaseServer()).from("web_projects").select("id,name,created_at").order("created_at", { ascending: false });
  return (
    <>
      <h1 className="text-2xl font-bold">Web Studio</h1>
      <h2 className="mt-6 font-semibold">Proyectos</h2>
      {projects?.length ? <ul className="mt-2 divide-y divide-current/15 rounded border border-current/20">{projects.map((p) => <li key={p.id}><Link className="block p-3 hover:bg-current/5" href={`/app/web-studio/${p.id}`}>{p.name}</Link></li>)}</ul> : <p className="mt-2 text-sm opacity-70">Aún no tienes proyectos. Crea el primero abajo.</p>}
      <h2 className="mt-8 font-semibold">Desde plantilla (sin IA)</h2>
      <div className="mt-2 flex flex-wrap gap-2">{Object.entries(TEMPLATES).map(([k, t]) => <form key={k} action={createFromTemplate.bind(null, k)}><button className="rounded border border-current/30 px-3 py-1.5 text-sm hover:bg-current/10">{t.label}</button></form>)}</div>
      <h2 className="mt-8 font-semibold">Nuevo proyecto con IA</h2>
      <NewProject />
    </>
  );
}
