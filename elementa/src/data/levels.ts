/** Títulos por nivel (índice 0 = nivel 1). Del nivel 9 en adelante: "Mente Cuántica". */
export const LEVEL_TITLES: readonly string[] = [
  'Aprendiz',
  'Explorador',
  'Químico Junior',
  'Químico',
  'Experto',
  'Maestro de los Elementos',
  'Gran Maestro',
  'Leyenda Atómica',
  'Mente Cuántica',
];

/** Emoji decorativo por nivel (mismo índice que `LEVEL_TITLES`). */
export const LEVEL_EMOJIS: readonly string[] = ['🌱', '🧭', '🧪', '⚗️', '🔬', '🧙', '🏅', '🌟', '🌌'];

/** Nivel a partir del cual el título deja de cambiar. */
export const MAX_TITLED_LEVEL = LEVEL_TITLES.length;
