import type { QuestionSkill } from './quiz';

/** Modo de juego que originó una respuesta o sesión. */
export type GameMode =
  | 'diagnostic'
  | 'study' // Estudiar ahora (sesión inteligente)
  | 'learn5' // Aprende 5
  | 'flashcards'
  | 'trivia' // Modo Preguntados
  | 'exam'
  | 'timeAttack' // Contrarreloj
  | 'survival' // Supervivencia
  | 'streak' // Modo Racha
  | 'visual' // Preguntas visuales en la tabla
  | 'practice'; // Práctica libre (mis errores, bloques, familias)

/** Calificación de flashcard para repetición espaciada. */
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy'; // ❌ No lo sabía · 😐 Casi · ✅ Lo sabía · ⚡ Muy fácil

export type ExperienceLevel = 'beginner' | 'some' | 'chemistry' | 'master';

export type ThemePreference = 'light' | 'dark' | 'system';

export type DailyGoal = 5 | 10 | 20 | 50;

export interface SkillCounts {
  correct: number;
  incorrect: number;
}

/** Progreso individual de un elemento (dominio + repetición espaciada). */
export interface ElementProgress {
  atomicNumber: number;
  /** Veces presentado (pregunta, flashcard o lección). */
  seen: number;
  correct: number;
  incorrect: number;
  /** Aciertos consecutivos actuales en este elemento. */
  streak: number;
  /** Últimos resultados (1 acierto, 0 fallo), más reciente al final, máx. 10. */
  recent: number[];
  /** Media móvil exponencial del tiempo de respuesta (ms). */
  avgResponseMs: number | null;
  lastSeen: string | null; // ISO
  lastCorrect: string | null; // ISO
  // --- Repetición espaciada (SM-2 simplificado) ---
  ease: number; // 1.3 – 3.0 (inicial 2.5)
  intervalDays: number; // 0 = volver a mostrar en esta sesión/hoy
  reps: number; // repasos exitosos consecutivos
  due: string | null; // ISO: cuándo toca repasar
  // --- Aprendizaje ---
  /** Introducido al usuario (Aprende 5, bloques o primer acierto). */
  learned: boolean;
  learnedAt: string | null; // ISO
  skills: Partial<Record<QuestionSkill, SkillCounts>>;
}

/** Pregunta fallada guardada para "Mis errores". */
export interface MistakeRecord {
  id: string;
  atomicNumber: number;
  skill: QuestionSkill;
  prompt: string;
  correctAnswer: string;
  givenAnswer: string;
  mode: GameMode;
  at: string; // ISO
}

/** Actividad agregada por día local (clave YYYY-MM-DD). */
export interface DailyActivity {
  date: string;
  /** Actividad que cuenta para la meta diaria: respuestas de quiz + flashcards calificadas. */
  questions: number;
  /** Aciertos de quiz (las flashcards no cuentan). Precisión del día: `correct / (questions − flashcards)`. */
  correct: number;
  /** Flashcards calificadas (incluidas en `questions`). */
  flashcards: number;
  xp: number;
  timeMs: number;
  /** Elementos marcados como aprendidos ese día. */
  newLearned: number;
  /** Meta diaria vigente cuando se alcanzó (o la actual si no se alcanzó). */
  goal: number;
  goalMet: boolean;
}

export interface PersonalRecords {
  timeAttackBest: number; // aciertos en 60 s
  survivalBest: number; // aciertos antes de perder las 3 vidas
  streakModeBest: number; // mejor racha en Modo Racha
  bestAnswerStreak: number; // mejor racha de aciertos consecutivos en cualquier modo
  bestExamPct: number; // 0–100
}

export interface GlobalStats {
  totalQuestions: number;
  totalCorrect: number;
  totalTimeMs: number;
  sessionsCompleted: number;
  examsCompleted: number;
  perfectExams: number;
  flashcardsReviewed: number;
  /** Racha de aciertos consecutivos actual (todos los modos). */
  currentAnswerStreak: number;
}

export interface UserSettings {
  theme: ThemePreference;
  dailyGoal: DailyGoal;
  sound: boolean;
  haptics: boolean;
}

export interface UserProfile {
  name: string;
  experience: ExperienceLevel | null;
  onboarded: boolean;
  createdAt: string; // ISO
}

/** Estado persistido completo. Serializable a JSON (localStorage hoy; Supabase/Firebase mañana). */
export interface ProgressState {
  version: 1;
  profile: UserProfile;
  settings: UserSettings;
  xp: number;
  /** Clave: número atómico. Solo existen entradas para elementos ya vistos. */
  elements: Record<number, ElementProgress>;
  /** Más reciente primero, máx. 300. */
  mistakes: MistakeRecord[];
  /** Clave: YYYY-MM-DD (hora local). */
  daily: Record<string, DailyActivity>;
  records: PersonalRecords;
  stats: GlobalStats;
  /** id de logro → ISO de desbloqueo. */
  achievements: Record<string, string>;
  updatedAt: string; // ISO
}

/** Dominio calculado de un elemento. */
export type MasteryTier = 'practice' | 'learning' | 'almost' | 'mastered'; // 🔴 🟠 🟡 🟢

/** Lo que devuelve registrar una respuesta (para feedback inmediato en la UI). */
export interface AnswerOutcome {
  xpGained: number;
  /**
   * XP por encima de la regla por defecto incluida en `xpGained` (`xpOverride − xpForAnswer`): en Modo
   * Racha, el extra del multiplicador MÁS el bonus del hito. Para mostrar solo el bonus del hito usar
   * `streakModeXp(streak, difficulty).bonus`.
   */
  bonusXp: number;
  masteryBefore: number;
  masteryAfter: number;
  /** Racha de aciertos consecutivos global tras esta respuesta. */
  answerStreak: number;
  leveledUp: boolean;
  newLevel: number;
  unlockedAchievements: string[];
}

/** Resumen de una sesión terminada (para la pantalla de feedback). */
export interface SessionSummaryData {
  mode: GameMode;
  title: string;
  total: number;
  correct: number;
  xpGained: number;
  durationMs: number;
  /** Elementos cuyo dominio subió durante la sesión (nº atómico), mayor mejora primero. */
  improved: number[];
  /** Elementos fallados durante la sesión. */
  toReview: number[];
  newRecord?: { label: string; value: number };
  unlockedAchievements: string[];
}
