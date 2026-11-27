import { canConsume, type Entitlement } from "../plans";

export type AiRequest = { system?: string; prompt: string; maxTokens?: number };
export type AiResult = { text: string; provider: ProviderId; inputTokens: number; outputTokens: number; credits: number };
export type ProviderId = "anthropic" | "openai" | "gemini";
export type FetchFn = typeof fetch;

export class ProviderNotConfigured extends Error { constructor(public provider?: string) { super("No hay proveedor de IA configurado"); } }
export class CreditsExhausted extends Error { constructor() { super("Créditos de IA agotados para el plan"); } }

/** 1 crédito = 1000 tokens totales (unidad interna; el costo real por proveedor debe validarse). */
export const creditsFor = (i: number, o: number) => Math.max(1, Math.ceil((i + o) / 1000));

type Adapter = { id: ProviderId; envKey: string; call(key: string, r: AiRequest, f: FetchFn): Promise<Omit<AiResult, "provider" | "credits">> };

type Json = { [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => { if (!r.ok) throw new Error(`Proveedor respondió ${r.status}`); return (await r.json()) as Json; };

export const ADAPTERS: Adapter[] = [
  { id: "anthropic", envKey: "ANTHROPIC_API_KEY", async call(key, r, f) {
    const d = await j(await f("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5", max_tokens: r.maxTokens ?? 1024, system: r.system, messages: [{ role: "user", content: r.prompt }] }) }));
    return { text: d.content?.map((c: Json) => c.text ?? "").join("") ?? "", inputTokens: d.usage?.input_tokens ?? 0, outputTokens: d.usage?.output_tokens ?? 0 };
  } },
  { id: "openai", envKey: "OPENAI_API_KEY", async call(key, r, f) {
    const d = await j(await f("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", max_tokens: r.maxTokens ?? 1024, messages: [...(r.system ? [{ role: "system", content: r.system }] : []), { role: "user", content: r.prompt }] }) }));
    return { text: d.choices?.[0]?.message?.content ?? "", inputTokens: d.usage?.prompt_tokens ?? 0, outputTokens: d.usage?.completion_tokens ?? 0 };
  } },
  { id: "gemini", envKey: "GEMINI_API_KEY", async call(key, r, f) {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const d = await j(await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: r.system ? { parts: [{ text: r.system }] } : undefined, contents: [{ role: "user", parts: [{ text: r.prompt }] }], generationConfig: { maxOutputTokens: r.maxTokens ?? 1024 } }) }));
    return { text: d.candidates?.[0]?.content?.parts?.map((p: Json) => p.text ?? "").join("") ?? "", inputTokens: d.usageMetadata?.promptTokenCount ?? 0, outputTokens: d.usageMetadata?.candidatesTokenCount ?? 0 };
  } },
];

export type GatewayDeps = { env?: Record<string, string | undefined>; fetchFn?: FetchFn; recordUsage?: (u: { provider: ProviderId; credits: number }) => Promise<void> | void };

/** Punto único de acceso a IA: elige proveedor configurado, aplica límite del plan y registra consumo. */
export async function generate(req: AiRequest, ent: Entitlement, deps: GatewayDeps = {}): Promise<AiResult> {
  const env = deps.env ?? process.env;
  const ad = ADAPTERS.find((a) => env[a.envKey]);
  if (!ad) throw new ProviderNotConfigured();
  if (!canConsume(ent, 1).allowed) throw new CreditsExhausted();
  const out = await ad.call(env[ad.envKey]!, req, deps.fetchFn ?? fetch);
  const credits = creditsFor(out.inputTokens, out.outputTokens);
  await deps.recordUsage?.({ provider: ad.id, credits });
  return { ...out, provider: ad.id, credits };
}
