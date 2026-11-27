export type IntegrationId = "anthropic" | "openai" | "gemini" | "supabase" | "stripe" | "mercadopago" | "whatsapp" | "meta-ads" | "google" | "elevenlabs" | "twilio";
export type Integration = { id: IntegrationId; name: string; env: string[]; docs: string; usedBy: string[] };

export const INTEGRATIONS: Integration[] = [
  { id: "anthropic", name: "Anthropic", env: ["ANTHROPIC_API_KEY"], docs: "https://docs.anthropic.com", usedBy: ["*"] },
  { id: "openai", name: "OpenAI", env: ["OPENAI_API_KEY"], docs: "https://platform.openai.com/docs", usedBy: ["*"] },
  { id: "gemini", name: "Google Gemini", env: ["GEMINI_API_KEY"], docs: "https://ai.google.dev", usedBy: ["*"] },
  { id: "supabase", name: "Supabase", env: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], docs: "https://supabase.com/docs", usedBy: ["*"] },
  { id: "stripe", name: "Stripe", env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], docs: "https://docs.stripe.com", usedBy: ["billing"] },
  { id: "mercadopago", name: "Mercado Pago", env: ["MERCADOPAGO_ACCESS_TOKEN"], docs: "https://www.mercadopago.com.mx/developers", usedBy: ["billing"] },
  { id: "whatsapp", name: "WhatsApp Business (Cloud API)", env: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_VERIFY_TOKEN"], docs: "https://developers.facebook.com/docs/whatsapp/cloud-api", usedBy: ["chat-agent"] },
  { id: "meta-ads", name: "Meta Ads", env: ["META_ADS_TOKEN"], docs: "https://developers.facebook.com/docs/marketing-apis", usedBy: ["ads-engine"] },
  { id: "google", name: "Google (Gmail/Calendar/Drive/Ads)", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], docs: "https://developers.google.com/identity/protocols/oauth2", usedBy: ["personal-assistant", "lead-engine", "ads-engine"] },
  { id: "elevenlabs", name: "ElevenLabs", env: ["ELEVENLABS_API_KEY"], docs: "https://elevenlabs.io/docs", usedBy: ["voice-agent", "video-studio"] },
  { id: "twilio", name: "Twilio", env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], docs: "https://www.twilio.com/docs", usedBy: ["voice-agent"] },
];

export type Status = { id: IntegrationId; configured: boolean; missing: string[] };
/** Solo verifica presencia de credenciales; NO prueba conexión real ni la declara "validada". */
export function status(env: Record<string, string | undefined> = process.env): Status[] {
  return INTEGRATIONS.map((i) => { const missing = i.env.filter((k) => !env[k]); return { id: i.id, configured: missing.length === 0, missing }; });
}
