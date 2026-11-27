export const MODULE_IDS = [
  "web-studio", "chat-agent", "personal-assistant", "ads-engine", "voice-agent",
  "data-intelligence", "lead-engine", "video-studio", "content-studio", "second-brain",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleDef = {
  id: ModuleId;
  name: string;
  tagline: { es: string; en: string };
  phase: number; // orden de desarrollo recomendado
  /** Consumo variable (telefonía, video, mensajería, APIs IA) que debe limitarse/cobrarse aparte */
  metered: boolean;
  status: "planned" | "alpha" | "beta" | "stable";
};

export const MODULES: Record<ModuleId, ModuleDef> = {
  "web-studio": { id: "web-studio", name: "Web Studio", tagline: { es: "Creación de sitios web", en: "Website creation" }, phase: 2, metered: true, status: "planned" },
  "chat-agent": { id: "chat-agent", name: "Chat Agent", tagline: { es: "Atención y ventas por WhatsApp", en: "WhatsApp support & sales" }, phase: 6, metered: true, status: "planned" },
  "personal-assistant": { id: "personal-assistant", name: "Personal Assistant", tagline: { es: "Productividad y organización", en: "Productivity & organization" }, phase: 4, metered: true, status: "planned" },
  "ads-engine": { id: "ads-engine", name: "Ads Engine", tagline: { es: "Publicidad inteligente", en: "Smart advertising" }, phase: 3, metered: true, status: "planned" },
  "voice-agent": { id: "voice-agent", name: "Voice Agent", tagline: { es: "Recepcionista telefónico", en: "Phone receptionist" }, phase: 6, metered: true, status: "planned" },
  "data-intelligence": { id: "data-intelligence", name: "Data Intelligence", tagline: { es: "Dashboards y análisis de datos", en: "Dashboards & data analysis" }, phase: 5, metered: true, status: "planned" },
  "lead-engine": { id: "lead-engine", name: "Lead Engine", tagline: { es: "Prospección y correos comerciales", en: "Prospecting & sales email" }, phase: 3, metered: true, status: "planned" },
  "video-studio": { id: "video-studio", name: "Video Studio", tagline: { es: "Producción audiovisual", en: "Video production" }, phase: 7, metered: true, status: "planned" },
  "content-studio": { id: "content-studio", name: "Content Studio", tagline: { es: "Generación de contenido", en: "Content generation" }, phase: 2, metered: true, status: "planned" },
  "second-brain": { id: "second-brain", name: "Second Brain", tagline: { es: "Memoria y conocimiento", en: "Memory & knowledge" }, phase: 4, metered: true, status: "planned" },
};

export const isModuleId = (v: string): v is ModuleId => (MODULE_IDS as readonly string[]).includes(v);
