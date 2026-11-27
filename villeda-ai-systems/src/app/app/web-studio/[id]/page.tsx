import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { supabaseServer } from "@/lib/supabase/server";
import { siteSchema } from "@/core/web-studio/spec";
import { renderSite } from "@/core/web-studio/render";
import { audit } from "@/core/web-studio/audit";
import { restoreVersion } from "../actions";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status">Cargando…</p>}><Project params={params} /></Suspense>;
}

async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getContext())) notFound();
  const sb = await supabaseServer();
  const { data: proj } = await sb.from("web_projects").select("name").eq("id", id).maybeSingle();
  const { data: vs } = await sb.from("web_versions").select("n,note,at,spec").eq("project_id", id).order("n", { ascending: false });
  if (!proj || !vs?.length) notFound();
  const spec = siteSchema.parse(vs[0].spec);
  const findings = audit(spec);
  return (
    <>
      <h1 className="text-2xl font-bold">{proj.name}</h1>
      <p className="mt-1 space-x-4 text-sm"><a className="underline" href={`/app/web-studio/${id}/export`}>Descargar HTML</a></p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <iframe title="Vista previa" sandbox="" srcDoc={renderSite(spec)} className="h-[70vh] w-full rounded border border-current/20 bg-white" />
        <aside className="space-y-6 text-sm">
          <section><h2 className="font-semibold">Auditoría SEO / accesibilidad</h2>
            {findings.length ? <ul className="mt-2 space-y-1">{findings.map((f) => <li key={f.code}><b className={f.level === "error" ? "text-red-500" : "text-yellow-600"}>{f.level}</b> {f.message}</li>)}</ul> : <p className="mt-2 opacity-70">Sin hallazgos en las reglas estáticas.</p>}
          </section>
          <section><h2 className="font-semibold">Versiones</h2>
            <ul className="mt-2 space-y-2">{vs.map((v) => <li key={v.n} className="flex items-center justify-between gap-2"><span>v{v.n} · {v.note}</span>
              {v.n !== vs[0].n && <form action={restoreVersion.bind(null, id, v.n)}><button className="underline">Restaurar</button></form>}</li>)}</ul>
          </section>
        </aside>
      </div>
    </>
  );
}
