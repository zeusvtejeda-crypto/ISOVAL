"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canUseModule } from "@/core/plans";
import { generateSite } from "@/core/web-studio/generate";
import { siteSchema } from "@/core/web-studio/spec";
import type { FormState } from "@/app/actions";

async function guard() {
  const ctx = await getContext();
  if (!ctx) throw new Error("Supabase no configurado");
  if (!canUseModule(ctx.ent, "web-studio").allowed) throw new Error("Módulo no contratado");
  return ctx;
}
const input = z.object({ name: z.string().min(1).max(80), description: z.string().min(10, "Describe el negocio (mín. 10 caracteres)").max(4000), facts: z.string().max(4000).optional() });

export async function createProject(_: FormState, fd: FormData): Promise<FormState> {
  const p = input.safeParse(Object.fromEntries(fd)); if (!p.success) return { error: p.error.issues[0].message };
  let id: string;
  try {
    const ctx = await guard();
    const facts: Record<string, string> = p.data.facts ? { datos: p.data.facts } : {};
    const spec = await generateSite({ description: p.data.description, facts }, ctx.ent, {
      recordUsage: async ({ provider, credits }) => { await supabaseAdmin().from("usage_ledger").insert({ workspace_id: ctx.workspaceId, module_id: "web-studio", provider, units: credits, kind: "ai.generate" }); },
    });
    const sb = await supabaseServer();
    const { data: proj, error } = await sb.from("web_projects").insert({ workspace_id: ctx.workspaceId, name: p.data.name, brief: { description: p.data.description, facts }, created_by: ctx.userId }).select("id").single();
    if (error || !proj) throw new Error("No se pudo guardar el proyecto");
    await sb.from("web_versions").insert({ project_id: proj.id, workspace_id: ctx.workspaceId, n: 1, spec, note: "Generado con IA" });
    id = proj.id;
  } catch (e) { return { error: e instanceof Error ? e.message : "Error inesperado" }; }
  redirect(`/app/web-studio/${id}`);
}

export async function restoreVersion(projectId: string, n: number) {
  const ctx = await guard(); const sb = await supabaseServer();
  const { data: v } = await sb.from("web_versions").select("spec").eq("project_id", projectId).eq("n", n).single();
  const { data: last } = await sb.from("web_versions").select("n").eq("project_id", projectId).order("n", { ascending: false }).limit(1).single();
  if (!v || !last) throw new Error("Versión no encontrada");
  await sb.from("web_versions").insert({ project_id: projectId, workspace_id: ctx.workspaceId, n: last.n + 1, spec: siteSchema.parse(v.spec), note: `Restaurada v${n}` });
  revalidatePath(`/app/web-studio/${projectId}`);
}
