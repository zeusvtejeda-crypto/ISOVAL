import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { chunk, search } from "./knowledge";
import { respond, isOpen, ungroundedFigures, DEFAULT_OPT_OUT, type AgentConfig } from "./agent";
import { verifySignature, verifyChallenge, parseInbound, sendText } from "./whatsapp";

const kb = chunk([{ id: "1", title: "Precios", text: "Corte de cabello: $250 MXN.\n\nBarba: $150 MXN." }, { id: "2", title: "Horario", text: "Abrimos de lunes a sábado de 10:00 a 19:00." }, { id: "3", title: "Ubicación", text: "Estamos en Av. México 123, Tepic." }]);
const cfg: AgentConfig = { businessName: "Demo", persona: "Amable y breve.", language: "es", humanHandoffMessage: "Te paso con una persona del equipo.", optOutKeywords: DEFAULT_OPT_OUT };
const ent = { plan: "business" as const, modules: [], creditsUsed: 0 };
const ai = (obj: unknown) => ({ env: { ANTHROPIC_API_KEY: "k" }, fetchFn: vi.fn(async () => new Response(JSON.stringify({ content: [{ text: JSON.stringify(obj) }], usage: {} }))) as unknown as typeof fetch }); // IA SIMULADA

describe("knowledge", () => {
  it("encuentra el documento correcto", () => expect(search(kb, "¿cuánto cuesta el corte?")[0].title).toBe("Precios"));
  it("ignora acentos", () => expect(search(kb, "ubicacion")[0].title).toBe("Ubicación"));
  it("sin coincidencias → []", () => expect(search(kb, "criptomonedas")).toEqual([]));
});
describe("agente", () => {
  it("responde con base en conocimiento", async () => {
    const d = await respond(cfg, kb, [], "cuanto cuesta el corte", ent, ai({ reply: "El corte cuesta $250 MXN.", intent: "pricing", handoff: false, sources: ["Precios"] }));
    expect(d).toMatchObject({ handoff: false, reason: "ok", sources: ["Precios"] });
  });
  it("transfiere si no hay conocimiento (sin llamar a la IA)", async () => {
    const deps = ai({}); const d = await respond(cfg, kb, [], "venden criptomonedas", ent, deps);
    expect(d).toMatchObject({ handoff: true, reason: "no_knowledge" }); expect(deps.fetchFn).not.toHaveBeenCalled();
  });
  it("BLOQUEA precios inventados", async () => {
    const d = await respond(cfg, kb, [], "cuanto cuesta el corte", ent, ai({ reply: "El corte cuesta $199 MXN.", handoff: false }));
    expect(d).toMatchObject({ handoff: true, reason: "ungrounded_figure" });
  });
  it("respeta baja/opt-out", async () => expect(await respond(cfg, kb, [], "STOP", ent, ai({}))).toMatchObject({ optOut: true, reason: "opt_out", handoff: false }));
  it("salida de modelo inválida → humano", async () => {
    const deps = { env: { ANTHROPIC_API_KEY: "k" }, fetchFn: vi.fn(async () => new Response(JSON.stringify({ content: [{ text: "hola" }], usage: {} }))) as unknown as typeof fetch };
    expect(await respond(cfg, kb, [], "horario", ent, deps)).toMatchObject({ handoff: true, reason: "bad_model_output" });
  });
  it("sin IA configurada → humano", async () => expect(await respond(cfg, kb, [], "horario", ent, { env: {} })).toMatchObject({ handoff: true, reason: "ai_unavailable" }));
  it("detecta cifras no fundamentadas", () => expect(ungroundedFigures("Abrimos a las 09:00 y cuesta $250", kb)).toEqual(["09:00"]));
  it("horario en zona del negocio", () => {
    const h = { tz: "America/Mexico_City", days: [1, 2, 3, 4, 5], from: "10:00", to: "19:00" };
    expect(isOpen(h, new Date("2026-03-02T17:00:00Z"))).toBe(true); // lun 11:00 CST
    expect(isOpen(h, new Date("2026-03-02T03:00:00Z"))).toBe(false); // dom 21:00
  });
});
describe("whatsapp", () => {
  const body = JSON.stringify({ a: 1 }); const sig = "sha256=" + createHmac("sha256", "sec").update(body).digest("hex");
  it("firma válida/ inválida", () => { expect(verifySignature(body, sig, "sec")).toBe(true); expect(verifySignature(body, sig, "otro")).toBe(false); expect(verifySignature(body, null, "sec")).toBe(false); expect(verifySignature(body, "sha256=zz", "sec")).toBe(false); });
  it("challenge", () => { expect(verifyChallenge(new URLSearchParams("hub.mode=subscribe&hub.verify_token=t&hub.challenge=42"), "t")).toBe("42"); expect(verifyChallenge(new URLSearchParams("hub.mode=subscribe&hub.verify_token=x&hub.challenge=42"), "t")).toBeNull(); });
  it("parsea mensajes entrantes (payload de ejemplo)", () => {
    const m = parseInbound({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "P1" }, contacts: [{ wa_id: "5211", profile: { name: "Ana" } }], messages: [{ from: "5211", id: "m1", timestamp: "1", type: "text", text: { body: "hola" } }] } }] }] });
    expect(m).toEqual([{ phoneNumberId: "P1", from: "5211", id: "m1", type: "text", text: "hola", timestamp: "1", name: "Ana" }]);
  });
  it("sendText error propaga", async () => { await expect(sendText({ token: "t", phoneNumberId: "p", to: "1", body: "x" }, vi.fn(async () => new Response("", { status: 400 })) as unknown as typeof fetch)).rejects.toThrow("400"); });
});
