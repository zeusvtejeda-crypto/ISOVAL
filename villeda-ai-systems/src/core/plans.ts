import { MODULE_IDS, type ModuleId } from "./modules";

export type PlanId = "starter" | "professional" | "business" | "agency";

export type Plan = {
  id: PlanId;
  name: string;
  /** Precio inicial sugerido en MXN/mes. NO definitivo ni costo verificado. */
  priceMxnMonthly: number;
  maxModules: number; // Infinity = todos
  maxSeats: number;
  maxWorkspaces: number;
  automations: boolean;
  whiteLabel: boolean;
  /** Créditos de IA/mes (unidad abstracta; el costo real por proveedor debe validarse). */
  aiCreditsMonthly: number;
};

export const PLANS: Record<PlanId, Plan> = {
  starter: { id: "starter", name: "Starter", priceMxnMonthly: 299, maxModules: 1, maxSeats: 1, maxWorkspaces: 1, automations: false, whiteLabel: false, aiCreditsMonthly: 500 },
  professional: { id: "professional", name: "Professional", priceMxnMonthly: 799, maxModules: 3, maxSeats: 3, maxWorkspaces: 1, automations: true, whiteLabel: false, aiCreditsMonthly: 3000 },
  business: { id: "business", name: "Business", priceMxnMonthly: 1999, maxModules: MODULE_IDS.length, maxSeats: 10, maxWorkspaces: 1, automations: true, whiteLabel: false, aiCreditsMonthly: 15000 },
  agency: { id: "agency", name: "Agency", priceMxnMonthly: 4999, maxModules: MODULE_IDS.length, maxSeats: 50, maxWorkspaces: 25, automations: true, whiteLabel: true, aiCreditsMonthly: 60000 },
};

export type Entitlement = { plan: PlanId; modules: ModuleId[]; creditsUsed: number };
export type Decision = { allowed: true } | { allowed: false; reason: "module_not_contracted" | "module_limit" | "credits_exhausted" | "automations_not_in_plan" };

/** ¿Puede el workspace usar este módulo? (función pura, sin I/O) */
export function canUseModule(e: Entitlement, m: ModuleId): Decision {
  return e.modules.includes(m) ? { allowed: true } : { allowed: false, reason: "module_not_contracted" };
}

/** ¿Puede contratar un módulo adicional bajo su plan? */
export function canAddModule(e: Entitlement, m: ModuleId): Decision {
  if (e.modules.includes(m)) return { allowed: true };
  return e.modules.length >= PLANS[e.plan].maxModules ? { allowed: false, reason: "module_limit" } : { allowed: true };
}

/** Control de consumo IA: bloquea si el costo excede los créditos del plan. */
export function canConsume(e: Entitlement, cost: number): Decision {
  return e.creditsUsed + cost > PLANS[e.plan].aiCreditsMonthly ? { allowed: false, reason: "credits_exhausted" } : { allowed: true };
}

export function canAutomate(e: Entitlement): Decision {
  return PLANS[e.plan].automations ? { allowed: true } : { allowed: false, reason: "automations_not_in_plan" };
}
