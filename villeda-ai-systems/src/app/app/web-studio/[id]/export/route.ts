import { getContext } from "@/lib/context";
import { supabaseServer } from "@/lib/supabase/server";
import { siteSchema } from "@/core/web-studio/spec";
import { renderSite } from "@/core/web-studio/render";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getContext())) return new Response("No configurado", { status: 503 });
  const { data } = await (await supabaseServer()).from("web_versions").select("spec").eq("project_id", id).order("n", { ascending: false }).limit(1).maybeSingle();
  if (!data) return new Response("No encontrado", { status: 404 });
  return new Response(renderSite(siteSchema.parse(data.spec)), { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="sitio.html"` } });
}
