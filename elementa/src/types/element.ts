/** Clasificación química usada para colorear la tabla y agrupar familias. */
export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide';

/** Estado de agregación a condiciones estándar (25 °C, 1 atm). `unknown` = nunca obtenido en cantidad visible. */
export type Phase = 'solid' | 'liquid' | 'gas' | 'unknown';

export type Block = 's' | 'p' | 'd' | 'f';

export interface ChemicalElement {
  atomicNumber: number;
  symbol: string;
  /** Nombre en español (IUPAC/RAE). */
  name: string;
  /** Grafías alternativas aceptadas (p. ej. "Tungsteno" para Wolframio). */
  altNames: string[];
  /** Peso atómico estándar abreviado (IUPAC). Si `massIsMassNumber`, es el número másico del isótopo más estable. */
  atomicMass: number;
  massIsMassNumber: boolean;
  /** Grupo 1–18. `null` para lantánidos y actínidos (bloque f). */
  group: number | null;
  period: number;
  block: Block;
  category: ElementCategory;
  phase: Phase;
  /**
   * El estado es una predicción: nunca se ha reunido una muestra visible (astato y francio).
   * No se pregunta y la ficha lo muestra como "Sólido (predicho)".
   */
  phasePredicted?: boolean;
  /** Configuración en orden de llenado (Möller) con dígitos planos, p. ej. "[He] 2s2 2p4". */
  electronConfiguration: string;
  /** Electronegatividad de Pauling, `null` si no está definida. */
  electronegativity: number | null;
  /** No tiene isótopos estables. */
  radioactive: boolean;
  /** Superpesado: la mayoría de sus propiedades son predicciones teóricas. */
  predicted: boolean;
  /** 1–2 frases: qué es y para qué se usa. */
  description: string;
  funFact: string;
  /** Técnica breve para memorizarlo. */
  memoryTip: string;
  /** Origen del nombre/símbolo, p. ej. "Na proviene del latín Natrium." */
  etymology: string;
  /** 2–3 usos cortos. */
  uses: string[];
}
