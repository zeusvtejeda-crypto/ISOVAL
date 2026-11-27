"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string } | undefined;
const cred = z.object({ email: z.string().email("Correo inválido"), password: z.string().min(8, "Mínimo 8 caracteres") });
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const configured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NOT_CFG = "Supabase no está configurado (ver .env.example).";

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const p = cred.safeParse(Object.fromEntries(fd)); if (!p.success) return { error: p.error.issues[0].message };
  if (!configured()) return { error: NOT_CFG };
  const { error } = await (await supabaseServer()).auth.signInWithPassword(p.data);
  if (error) return { error: "Credenciales incorrectas" };
  redirect("/app");
}
export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const p = cred.safeParse(Object.fromEntries(fd)); if (!p.success) return { error: p.error.issues[0].message };
  if (!configured()) return { error: NOT_CFG };
  const { data, error } = await (await supabaseServer()).auth.signUp({ ...p.data, options: { emailRedirectTo: `${site()}/auth/callback` } });
  if (error) return { error: error.message };
  if (data.session) redirect("/onboarding");
  return { ok: "Revisa tu correo para confirmar la cuenta." };
}
export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = z.string().email().safeParse(fd.get("email")); if (!email.success) return { error: "Correo inválido" };
  if (!configured()) return { error: NOT_CFG };
  await (await supabaseServer()).auth.resetPasswordForEmail(email.data, { redirectTo: `${site()}/auth/callback?next=/app/settings` });
  return { ok: "Si el correo existe, recibirás un enlace." }; // misma respuesta exista o no (anti-enumeración)
}
export async function createWorkspace(_: FormState, fd: FormData): Promise<FormState> {
  const name = z.string().min(2, "Nombre muy corto").max(80).safeParse(fd.get("name")); if (!name.success) return { error: name.error.issues[0].message };
  const { error } = await (await supabaseServer()).rpc("create_workspace", { p_name: name.data });
  if (error) return { error: "No se pudo crear el espacio de trabajo" };
  redirect("/app");
}
export async function logout() { await (await supabaseServer()).auth.signOut(); redirect("/login"); }
