import { describe, it, expect } from "vitest";
import { canAddModule, canConsume, canAutomate, canUseModule, PLANS } from "./plans";
import { route, type Automation, type PlatformEvent } from "./events";
import { MODULES, MODULE_IDS } from "./modules";

describe("modules", () => {
  it("registra los 10 módulos", () => { expect(MODULE_IDS).toHaveLength(10); expect(Object.keys(MODULES)).toHaveLength(10); });
});
describe("plans", () => {
  it("starter: 1 módulo máximo", () => {
    expect(canAddModule({ plan: "starter", modules: ["lead-engine"], creditsUsed: 0 }, "web-studio")).toEqual({ allowed: false, reason: "module_limit" });
  });
  it("business: los 10", () => expect(PLANS.business.maxModules).toBe(10));
  it("bloquea módulo no contratado", () => {
    expect(canUseModule({ plan: "professional", modules: [], creditsUsed: 0 }, "voice-agent")).toEqual({ allowed: false, reason: "module_not_contracted" });
  });
  it("bloquea consumo sobre el límite", () => {
    expect(canConsume({ plan: "starter", modules: [], creditsUsed: 490 }, 20)).toEqual({ allowed: false, reason: "credits_exhausted" });
    expect(canConsume({ plan: "starter", modules: [], creditsUsed: 490 }, 10)).toEqual({ allowed: true });
  });
  it("starter sin automatizaciones", () => expect(canAutomate({ plan: "starter", modules: [], creditsUsed: 0 })).toEqual({ allowed: false, reason: "automations_not_in_plan" }));
});
describe("event routing", () => {
  const ev: PlatformEvent = { id: "e1", workspaceId: "w1", source: "lead-engine", type: "lead.found", payload: {}, at: "" };
  const a: Automation = { id: "a1", workspaceId: "w1", enabled: true, trigger: { source: "lead-engine", type: "lead.found" }, action: { target: "personal-assistant", type: "task.create" }, requiresApproval: true };
  it("enruta y marca aprobación humana", () => {
    expect(route(ev, [a], ["lead-engine", "personal-assistant"])[0]).toMatchObject({ target: "personal-assistant", status: "pending_approval" });
  });
  it("aísla por workspace", () => expect(route({ ...ev, workspaceId: "w2" }, [a], ["lead-engine", "personal-assistant"])).toEqual([]));
  it("ignora módulos no contratados", () => expect(route(ev, [a], ["lead-engine"])).toEqual([]));
  it("ignora automatizaciones deshabilitadas", () => expect(route(ev, [{ ...a, enabled: false }], ["lead-engine", "personal-assistant"])).toEqual([]));
});
