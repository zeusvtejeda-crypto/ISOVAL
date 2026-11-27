import { describe, it, expect, vi } from "vitest";
import { generate, ProviderNotConfigured, CreditsExhausted, creditsFor } from "./gateway";
import { status } from "../integrations";

// DATOS SIMULADOS: fetch falso, no es una respuesta real de ningún proveedor.
const fakeFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
const ent = (used = 0) => ({ plan: "starter" as const, modules: [], creditsUsed: used });

describe("AI gateway", () => {
  it("falla claro sin proveedor configurado", async () => {
    await expect(generate({ prompt: "hola" }, ent(), { env: {} })).rejects.toBeInstanceOf(ProviderNotConfigured);
  });
  it("bloquea con créditos agotados sin llamar al proveedor", async () => {
    const f = fakeFetch({}); 
    await expect(generate({ prompt: "x" }, ent(500), { env: { ANTHROPIC_API_KEY: "k" }, fetchFn: f })).rejects.toBeInstanceOf(CreditsExhausted);
    expect(f).not.toHaveBeenCalled();
  });
  it("anthropic: parsea texto y registra consumo", async () => {
    const rec = vi.fn();
    const r = await generate({ prompt: "hola" }, ent(), { env: { ANTHROPIC_API_KEY: "k" }, recordUsage: rec,
      fetchFn: fakeFetch({ content: [{ text: "ok" }], usage: { input_tokens: 1500, output_tokens: 600 } }) });
    expect(r).toMatchObject({ text: "ok", provider: "anthropic", credits: 3 });
    expect(rec).toHaveBeenCalledWith({ provider: "anthropic", credits: 3 });
  });
  it("openai y gemini se parsean", async () => {
    expect((await generate({ prompt: "a" }, ent(), { env: { OPENAI_API_KEY: "k" }, fetchFn: fakeFetch({ choices: [{ message: { content: "o" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) })).text).toBe("o");
    expect((await generate({ prompt: "a" }, ent(), { env: { GEMINI_API_KEY: "k" }, fetchFn: fakeFetch({ candidates: [{ content: { parts: [{ text: "g" }] } }], usageMetadata: {} }) })).text).toBe("g");
  });
  it("error del proveedor se propaga", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    await expect(generate({ prompt: "a" }, ent(), { env: { OPENAI_API_KEY: "k" }, fetchFn: f })).rejects.toThrow("500");
  });
  it("créditos mínimo 1", () => expect(creditsFor(0, 0)).toBe(1));
});
describe("integrations", () => {
  it("reporta faltantes", () => {
    const s = status({ STRIPE_SECRET_KEY: "x" }).find((i) => i.id === "stripe")!;
    expect(s).toEqual({ id: "stripe", configured: false, missing: ["STRIPE_WEBHOOK_SECRET"] });
  });
});
