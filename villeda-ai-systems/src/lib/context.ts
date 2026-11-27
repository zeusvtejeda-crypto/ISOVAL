import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { isModuleId, type ModuleId } from "@/core/modules";
import type { Entitlement, PlanId } from "@/core/plans";

export type Ctx = { userId: string; workspaceId: string; workspaceName: string; ent: Entitlement };

/** Contexto autenticado del usuario. Todo acceso a datos pasa por RLS con el cliente del usuario. */
export async function getContext(): Promise<Ctx | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/login");
  const { data: ws } = await sb.from("workspaces").select("id,name,plan").limit(1).maybeSingle();
  if (!ws) redirect("/onboarding");
  const [{ data: subs }, { data: use }] = await Promise.all([
    sb.from("module_subscriptions").select("module_id").eq("workspace_id", ws.id).eq("active", true),
    sb.from("usage_ledger").select("units").eq("workspace_id", ws.id).eq("period", new Date().toISOString().slice(0, 7) + "-01"),
  ]);
  return {
    userId: u.user.id, workspaceId: ws.id, workspaceName: ws.name,
    ent: { plan: ws.plan as PlanId, modules: (subs ?? []).map((s) => s.module_id).filter(isModuleId) as ModuleId[], creditsUsed: (use ?? []).reduce((a, r) => a + Number(r.units), 0) },
  };
}

/** Entitlement de un workspace desde el servidor (webhooks, sin sesión de usuario). SOLO servidor. */
export async function entitlementFor(workspaceId: string): Promise<Entitlement> {
  const { supabaseAdmin } = await import("./supabase/admin");
  const a = supabaseAdmin();
  const { data: ws } = await a.from("workspaces").select("plan").eq("id", workspaceId).single();
  const [{ data: subs }, { data: use }] = await Promise.all([
    a.from("module_subscriptions").select("module_id").eq("workspace_id", workspaceId).eq("active", true),
    a.from("usage_ledger").select("units").eq("workspace_id", workspaceId).eq("period", new Date().toISOString().slice(0, 7) + "-01"),
  ]);
  return { plan: (ws?.plan ?? "starter") as PlanId, modules: (subs ?? []).map((s) => s.module_id).filter(isModuleId) as ModuleId[], creditsUsed: (use ?? []).reduce((x, r) => x + Number(r.units), 0) };
}
