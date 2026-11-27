import type { ModuleId } from "./modules";

/** Eventos entre módulos. Solo fluyen si el workspace lo autorizó (ver `links`). */
export type PlatformEvent = {
  id: string;
  workspaceId: string;
  source: ModuleId;
  type: string; // p.ej. "lead.found"
  payload: Record<string, unknown>;
  at: string;
};

export type Automation = {
  id: string;
  workspaceId: string;
  enabled: boolean;
  trigger: { source: ModuleId; type: string };
  action: { target: ModuleId; type: string };
  /** Acciones sensibles requieren aprobación humana antes de ejecutarse. */
  requiresApproval: boolean;
};

export type Dispatch = { automationId: string; target: ModuleId; action: string; status: "queued" | "pending_approval"; event: PlatformEvent };

/** Determina qué automatizaciones disparan para un evento. Aísla por workspace y respeta módulos contratados. */
export function route(event: PlatformEvent, automations: Automation[], contracted: ModuleId[]): Dispatch[] {
  return automations
    .filter((a) => a.enabled && a.workspaceId === event.workspaceId && a.trigger.source === event.source && a.trigger.type === event.type)
    .filter((a) => contracted.includes(a.action.target) && contracted.includes(a.trigger.source))
    .map((a) => ({ automationId: a.id, target: a.action.target, action: a.action.type, status: a.requiresApproval ? "pending_approval" : "queued", event }));
}
