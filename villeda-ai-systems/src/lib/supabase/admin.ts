import { createClient } from "@supabase/supabase-js";
/** SOLO servidor. service_role salta RLS: usar únicamente para ledger/auditoría tras validar al usuario. */
export const supabaseAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
