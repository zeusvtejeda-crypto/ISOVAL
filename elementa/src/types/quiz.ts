/** Habilidad evaluada por una pregunta; se usa para estadísticas y dominio por tema. */
export type QuestionSkill =
  | 'symbol' // símbolo ↔ nombre
  | 'atomicNumber'
  | 'atomicMass'
  | 'group'
  | 'period'
  | 'category' // familia / clasificación
  | 'phase'
  | 'location' // ubicación en la tabla
  | 'configuration'
  | 'property';

/** Tipos concretos de pregunta que sabe generar el motor. */
export type QuestionType =
  | 'symbol-to-name'
  | 'name-to-symbol'
  | 'number-to-element'
  | 'element-to-number'
  | 'element-to-mass'
  | 'element-to-group'
  | 'element-to-period'
  | 'element-to-category'
  | 'element-to-phase'
  | 'element-to-configuration'
  | 'location' // "¿Qué elemento está justo debajo del Oxígeno?" / "¿En qué periodo y grupo…?"
  | 'property' // "¿Cuál de estos es líquido a temperatura ambiente?"
  | 'classification' // "¿Cuál de estos es un halógeno?"
  // Preguntas visuales sobre la tabla:
  | 'table-find-element' // "¿Dónde está el Oxígeno?" (tocar la casilla)
  | 'table-find-number' // "Encuentra el elemento con número atómico 79"
  | 'table-select-category' // "Selecciona todos los gases nobles" (selección múltiple)
  | 'table-group-member'; // "¿Cuál de estos elementos pertenece al grupo 1?" (tocar en la tabla)

export type QuestionKind = 'multiple-choice' | 'table-select' | 'table-multi-select';

export interface QuestionOption {
  id: string; // 'a' | 'b' | 'c' | 'd'
  label: string;
  /** Texto secundario opcional (p. ej. el nombre bajo un símbolo). */
  sublabel?: string;
  correct: boolean;
  /** Elemento al que corresponde la opción, si aplica (para registrar dominio/errores). */
  atomicNumber?: number;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  type: QuestionType;
  skill: QuestionSkill;
  /** Elemento principal evaluado (el que suma/resta dominio). */
  atomicNumber: number;
  /** Enunciado: "¿Cuál es el símbolo del Sodio?" */
  prompt: string;
  /** Texto grande opcional a destacar (p. ej. "Na", "26"). */
  subject?: string;
  /** Solo `multiple-choice`: exactamente 4 opciones, una correcta. */
  options?: QuestionOption[];
  /** Solo preguntas de tabla: casillas correctas. En `table-select` hay una sola. */
  targetAtomicNumbers?: number[];
  /**
   * Solo `table-multi-select`: subconjunto de `targetAtomicNumbers` que se acepta pero no se exige
   * (clasificación discutida, p. ej. el Po en "Selecciona todos los metaloides").
   */
  optionalAtomicNumbers?: number[];
  /** Solo preguntas de tabla: casillas seleccionables (por defecto las 118). */
  selectableAtomicNumbers?: number[];
  /** Respuesta correcta legible: "Na", "Sodio", "Grupo 1"… */
  correctAnswer: string;
  /** Explicación breve mostrada tras responder. */
  explanation: string;
  /** 1 fácil · 2 media · 3 difícil. Las difíciles dan +15 XP. */
  difficulty: 1 | 2 | 3;
}

/** Temas que el usuario puede elegir en un examen personalizado. */
export type ExamTopic =
  | 'symbols'
  | 'atomicNumbers'
  | 'atomicMass'
  | 'families'
  | 'groups'
  | 'periods'
  | 'phase'
  | 'configuration'
  | 'location'
  | 'properties'
  | 'visual';

export interface QuestionGenOptions {
  count: number;
  /** Tipos permitidos; por defecto todos los de opción múltiple. */
  types?: QuestionType[];
  /** Elementos candidatos (número atómico). Por defecto los 118. */
  pool?: number[];
  /** Pondera la selección hacia elementos débiles/pendientes usando el progreso. Por defecto true. */
  adaptive?: boolean;
  /** Evitar repetir el mismo elemento dentro del conjunto cuando sea posible. Por defecto true. */
  uniqueElements?: boolean;
  /** Dificultad máxima permitida. */
  maxDifficulty?: 1 | 2 | 3;
}

/** Resultado de una pregunta respondida dentro de una sesión. */
export interface AnsweredQuestion {
  question: Question;
  correct: boolean;
  /** Texto de la respuesta dada ("—" si se acabó el tiempo). */
  givenAnswer: string;
  responseMs: number;
  xpGained: number;
}
