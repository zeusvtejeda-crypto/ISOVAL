# Elementa — Arquitectura

App web (PWA) para memorizar los 118 elementos con juegos, flashcards, repetición espaciada y exámenes.
Todo el progreso vive en el navegador (localStorage) y se accede a través de una capa de repositorio
intercambiable (Supabase/Firebase en el futuro).

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript estricto.
- Tailwind CSS v4 (configuración en `src/app/globals.css` con `@theme`; no hay `tailwind.config`).
- `lucide-react` para iconos de interfaz. Emojis para gamificación (🔥 ⚡ 🏆…).
- Sin backend: todas las páginas son componentes cliente renderizables estáticamente.
- Vitest para pruebas unitarias del motor (`src/utils/__tests__`).
- Next 16 difiere de versiones anteriores: ante dudas consultar `node_modules/next/dist/docs/`.

## Estructura

```
src/
  app/                    Rutas (App Router). Cada page.tsx es delgada: compone componentes.
  components/
    ui/                   Primitivas de diseño (Button, Card, Modal, ProgressBar…)
    layout/               AppShell, BottomNav, SideNav, TopBar, PageHeader, ThemeToggle
    gamification/         LevelBar, StreakBadge, StreakCalendar, MasteryBar, AchievementCard, Confetti, CelebrationHost
    periodic/             PeriodicTable, ElementTile, ElementDetail, CategoryLegend, ElementSearch
    quiz/                 QuestionRenderer, OptionButton, TableQuestion, FeedbackPanel, QuizHeader, SessionSummary
    flashcards/           Flashcard, RatingButtons, DeckPicker
    stats/                Gráficas SVG
    pwa/                  ServiceWorkerRegister, InstallPrompt
    <feature>/            Componentes propios de una página (dashboard/, onboarding/, exam/…)
  data/                   Datos estáticos: elements.ts (118), categories.ts, levels.ts, achievements.ts, blocks.ts
  types/                  Contratos compartidos (element.ts, progress.ts, quiz.ts)
  utils/                  Lógica pura, sin React (motor de aprendizaje, preguntas, formato…)
  hooks/                  Hooks de React
  store/                  Estado global del progreso (store externo + Provider)
  services/storage/       Repositorio de persistencia (localStorage hoy)
public/
  sw.js, icons/           PWA
```

## Rutas

| Ruta | Pantalla |
|---|---|
| `/` | Inicio (dashboard). Si `profile.onboarded === false` redirige a `/bienvenida`. |
| `/bienvenida` | Primer uso: nivel de experiencia + diagnóstico de 10 preguntas → nivel inicial. |
| `/estudiar` | "Estudiar ahora": sesión inteligente (nuevos + repasos + difíciles). |
| `/aprende` | "Aprende 5": 5 elementos nuevos, uno por uno, y luego preguntas de comprobación. `?block=<id>` o `?family=<category>` limita los elementos. |
| `/tabla` | Tabla periódica interactiva + buscador. `?e=<Z>` abre la ficha del elemento. |
| `/flashcards` | Flashcards con repetición espaciada (7 modos). `?elements=1,2,3` limita el mazo. |
| `/preguntados` | Trivia estilo Preguntados con ruleta de categorías. |
| `/examen` | Mini exámenes: rápido (10), normal (20), completo (50), personalizado. |
| `/contrarreloj` | 60 segundos: máximo de aciertos. Récord personal. |
| `/supervivencia` | 3 vidas ❤️❤️❤️. Récord personal. |
| `/racha` | Preguntas encadenadas con multiplicador y bonus x5/x10/x20. |
| `/visual` | Preguntas sobre la tabla: tocar casillas, selección múltiple. |
| `/practicar` | Práctica genérica. `?focus=errores|dificiles|repaso`, `?elements=19,26`, `?block=<id>`, `?family=<category>`, `?n=10`. |
| `/bloques` | Aprender por bloques (1–10, 11–20…) y por familias. |
| `/errores` | Mis errores: elementos más difíciles + preguntas falladas. |
| `/estadisticas` | Dashboard de estadísticas y gráficas. |
| `/logros` | Logros desbloqueables. |
| `/jugar` | Hub de todos los modos de juego. |
| `/ajustes` | Tema, meta diaria, sonido, exportar/importar/reiniciar progreso. |

Navegación: barra inferior en móvil (Inicio, Tabla, Jugar, Progreso=`/estadisticas`, Ajustes) y barra lateral en escritorio (≥ lg).

## Modelo de datos

Ver `src/types/*.ts` (fuente de verdad). Resumen:

- `ChemicalElement`: datos del elemento (numéricos verificados + textos en español).
- `ProgressState`: todo lo persistido (perfil, ajustes, XP, progreso por elemento, errores, actividad diaria, récords, logros).
- `ElementProgress`: aciertos/fallos, racha, tiempos, SRS (ease, interval, due), aprendido.
- `Question`: pregunta generada (opción múltiple o de tabla) con explicación.

## Motor (src/utils) — funciones puras

Nunca leen `localStorage` ni usan React. Reciben `now: Date` cuando dependen del tiempo.

### `random.ts`
`shuffle<T>(arr): T[]` (copia) · `sample<T>(arr, n): T[]` · `pick<T>(arr): T` · `weightedSample<T>(items, weights, n): T[]` (sin reemplazo) · `uid(): string`

### `dates.ts` (días en hora local, claves `YYYY-MM-DD`)
`dateKey(d: Date): string` · `todayKey(now?: Date): string` · `addDays(key, n): string` · `daysBetween(a, b): number` · `lastNDays(n, endKey?): string[]` (antiguo→reciente) · `weekKeys(key): string[]` (lunes→domingo de esa semana) · `WEEKDAY_LETTERS = ['L','M','M','J','V','S','D']` · `weekdayLetter(key): string` (lunes = 'L')

### `format.ts`
`formatMass(el): string` ("15.999"; entre corchetes si `massIsMassNumber`: "[98]") · `formatConfig(cfg): string` (superíndices: "[He] 2s² 2p⁴") · `formatNumber(n): string` (es-MX, "1,482") · `formatPercent(ratio0to1): string` ("82%") · `formatDuration(ms): string` ("7 h 32 min", "45 s") · `groupLabel(el): string` ("Grupo 1" / "Bloque f") · `phaseLabel(phase)` · `categoryLabel(cat, plural?)` · `normalizeText(s): string` (minúsculas sin acentos) · `pluralize(n, singular, plural)`

### `table-layout.ts`
`getGridPosition(el): { col: number; row: number }` → col 1–18; fila 1–7 tabla principal; fila 9 lantánidos (57–71 en col 3–17), fila 10 actínidos (89–103 en col 3–17); la fila 8 es separador.
`F_BLOCK_PLACEHOLDERS`: `{ lanthanides: { col: 3, row: 6, label: '57–71' }, actinides: { col: 3, row: 7, label: '89–103' } }`
`getNeighbor(el, dir: 'up'|'down'|'left'|'right'): ChemicalElement | null` (solo tabla principal, casilla contigua real)

### `search.ts`
`searchElements(query, limit = 8): ChemicalElement[]` — "Au" (símbolo exacto, sin distinguir mayúsculas), "79" (número), "oro"/"Oro"/"tungsteno" (nombre o altNames, sin acentos; prefijo antes que subcadena).

### `levels.ts` (+ `data/levels.ts` con títulos)
XP para pasar del nivel n al n+1: `100 + (n − 1) × 150` (N1: 100, N7: 1000).
Títulos: 1 Aprendiz · 2 Explorador · 3 Químico Junior · 4 Químico · 5 Experto · 6 Maestro de los Elementos · 7 Gran Maestro · 8 Leyenda Atómica · 9+ Mente Cuántica.
`xpToNext(level): number` · `xpAtLevelStart(level): number` · `levelFromXp(xp): LevelInfo` donde
`LevelInfo = { level; title; xpIntoLevel; xpForNext; progress /*0–1*/; totalXp }` · `levelTitle(level): string`

### `xp.ts`
`XP_RULES = { correct: 10, hardCorrect: 15, examComplete: 50, perfectExam: 100, learnElement: 5, flashcard: { again: 1, hard: 3, good: 5, easy: 5 }, sessionComplete: 20 }`
`xpForAnswer(correct, difficulty): number` (0 si falla; 15 si difficulty 3; 10 si no)
`streakModeXp(streak): { xp; bonus; milestone: 5|10|20|null }` — multiplicador x1 (1–4), x1.5 (5–9), x2 (10–19), x3 (20+) sobre 10 XP; bonus +25 al llegar a 5, +50 a 10, +150 a 20 ("bonus especial") y +100 en cada múltiplo de 10 posterior.

### `mastery.ts`
`computeMastery(p: ElementProgress | undefined, now): number` (0–100, entero). Combina precisión (bayesiana), precisión reciente (últimos 10), confianza por nº de respuestas (plena a partir de ~6), velocidad (`avgResponseMs`: ≤4 s sin penalización, ≥12 s −15 %) y olvido (decae si pasa el `due` sin repasar).
`masteryTier(m): MasteryTier` → `practice` < 40 ≤ `learning` < 65 ≤ `almost` < 85 ≤ `mastered`
`TIER_META: Record<MasteryTier, { label; emoji; barClass; textClass }>` — 🔴 Necesita práctica · 🟠 Aprendiendo · 🟡 Casi dominado · 🟢 Dominado
`MASTERED_THRESHOLD = 85`
`masteryMap(state, now): Record<number, number>` (los 118) · `countMastered(state, now)` · `countLearned(state)`

### `srs.ts` (SM-2 simplificado)
`createElementProgress(z): ElementProgress` · `applyRating(p, rating, now): ElementProgress` (again → reps 0, intervalo 0, due +10 min, ease −0.2; hard → intervalo ×1.2 (mín. 1 día), ease −0.15; good → 1 d, 3 d, luego intervalo×ease; easy → 4 d o intervalo×ease×1.3, ease +0.15; ease ∈ [1.3, 3.0])
`ratingFromAnswer(correct, responseMs): FlashcardRating` (fallo → again; acierto > 10 s → hard; < 3 s → easy; resto good)
`isDue(p, now): boolean`

### `engine.ts` — transiciones del estado (inmutables)
```ts
interface AnswerInput { atomicNumber; skill: QuestionSkill; correct: boolean; responseMs: number; mode: GameMode;
  prompt: string; correctAnswer: string; givenAnswer: string; difficulty?: 1|2|3;
  /** XP a otorgar en vez de la regla por defecto (p. ej. Modo Racha). */ xpOverride?: number; }
interface FlashcardInput { atomicNumber; skill: QuestionSkill; rating: FlashcardRating; responseMs: number }
interface SessionCompleteInput { mode: GameMode; total: number; correct: number; durationMs: number; isExam?: boolean }
createInitialState(now): ProgressState
applyAnswer(state, input, now): { state; outcome: AnswerOutcome }         // SRS + dominio + XP + diario + errores + racha global + logros
applyFlashcard(state, input, now): { state; outcome: AnswerOutcome }
applyLearned(state, atomicNumbers, now): { state; xpGained }              // +5 XP por elemento nuevo
applyXp(state, amount, now): { state; leveledUp; newLevel }
applySessionComplete(state, input, now): { state; xpGained; unlockedAchievements }  // +50 examen, +100 perfecto, +20 sesión
applyRecord(state, kind: 'timeAttack'|'survival'|'streakMode', value, now): { state; isNewRecord }
applyOnboarding(state, experience, diagnostic: AnsweredQuestion[], now): { state; level }
```
Registrar actividad diaria (`daily[todayKey]`) con `goalMet` cuando `questions >= settings.dailyGoal`. Las flashcards cuentan como preguntas.
Errores: cada fallo añade un `MistakeRecord` (máx. 300, más reciente primero).

### `streak.ts`
Un día cuenta para la racha cuando se cumple la meta diaria.
`computeStreak(daily, todayKey): { current; best; todayMet; atRisk /* ayer cumplido, hoy aún no */ }` (la racha sigue viva si ayer se cumplió aunque hoy no todavía)
`weekActivity(daily, todayKey): Array<{ key; letter; goalMet; active; isToday; isFuture }>` (lunes→domingo)

### `achievements.ts` (+ `data/achievements.ts`)
`ACHIEVEMENTS: AchievementDef[]` con `{ id; emoji; title; description; progress(ctx): { current; target } }`.
`evaluateAchievements(state, now): string[]` → ids recién desbloqueados (no presentes en `state.achievements`).
Incluye al menos: 🏆 Primer elemento · 🔥 En llamas (racha 7 días) · ⚛️ Medio camino (59 dominados) · 🧠 Memoria atómica (50 aciertos seguidos) · 👑 Maestro de la tabla (118 dominados) · ⚡ Velocidad química (20 aciertos en contrarreloj de 60 s), más logros de exámenes, familias, niveles, flashcards y volumen de preguntas.

### `questions.ts` — generador de preguntas
```ts
QUESTION_TYPE_META: Record<QuestionType, { label: string; skill: QuestionSkill; kind: QuestionKind; topic: ExamTopic }>
isApplicable(type, el): boolean                  // p. ej. grupo no aplica a lantánidos; fase no aplica a 'unknown'
generateQuestion(type, atomicNumber): Question | null
generateQuestions(opts: QuestionGenOptions, state?: ProgressState, now?: Date): Question[]
generateAdaptiveQuestion(state, now, opts?: { types?; pool?; exclude?: number[]; maxDifficulty? }): Question   // para modos infinitos
typesForTopics(topics: ExamTopic[]): QuestionType[]
checkTableAnswer(q, selected: number[]): boolean // table-select: selected == [target]; multi: conjunto exacto
MC_TYPES: QuestionType[]; TABLE_TYPES: QuestionType[]
```
Reglas: 4 opciones únicas y una sola correcta; distractores plausibles (símbolos inventados parecidos al nombre como "So"/"Sd" para Sodio, vecinos en la tabla, números cercanos, masas cercanas); explicaciones cortas y útiles ("El símbolo Na proviene del latín Natrium."). Nunca generar preguntas ambiguas (p. ej. electronegatividad solo con diferencia ≥ 0.3; propiedades solo con datos conocidos).

### `planner.ts` — algoritmo de aprendizaje
Prioridad de un elemento = fallos frecuentes (mayor peso) + días de retraso sobre `due` + elementos nuevos + respuestas lentas.
```ts
elementPriority(p | undefined, now): number
weakElements(state, now, limit?): Array<{ atomicNumber; mastery }>   // intentados, menor dominio primero
dueReviews(state, now, n): number[]
newElements(state, n, pool?): number[]                              // no aprendidos, en orden atómico
adaptivePool(state, now, n, pool?): number[]                        // muestreo ponderado por prioridad
planStudySession(state, now, opts?: { newCount = 5; reviewCount = 10; hardCount = 5 }): StudyPlan
interface StudyPlan { newElements: number[]; reviews: number[]; hard: number[]; questions: Question[]; estimatedMinutes: number }
```
Si el usuario es nuevo y no hay repasos/difíciles, el plan se completa con elementos nuevos/recientes para que nunca quede vacío.

### `blocks.ts` (en `data/`)
`STUDY_BLOCKS: { id: string /* 'b1' */; title: 'Bloque 1'; from: 1; to: 10; atomicNumbers: number[] }[]` (12 bloques; el último 111–118)
`FAMILY_GROUPS`: por categoría (usa `CATEGORY_ORDER`) con `atomicNumbers`.

## Estado global (src/store)

Store externo (sin dependencias) + `useSyncExternalStore`:
- `progress-store.ts`: `progressStore` con `getState()`, `subscribe(fn)`, `getServerSnapshot()`, acciones síncronas que usan `engine.ts` y devuelven el resultado, y un bus de eventos `onEvent(fn)` con eventos `{ type: 'xp', amount } | { type: 'levelUp', level } | { type: 'achievement', id } | { type: 'goalMet' }`.
- Persistencia vía `services/storage` con guardado con *debounce* (300 ms) y `flush` en `visibilitychange`/`pagehide`.
- `ProgressProvider.tsx` ('use client'): carga el estado al montar (`ready=false` hasta entonces) y lo expone.

Hook principal `useProgress()` (en `src/hooks/useProgress.ts`):
```ts
{ state; ready; level: LevelInfo; streak: StreakInfo; today: DailyActivity;
  recordAnswer(input: AnswerInput): AnswerOutcome;
  rateFlashcard(input: FlashcardInput): AnswerOutcome;
  markLearned(atomicNumbers: number[]): number /* xp */;
  addXp(amount: number): void;
  completeSession(input: SessionCompleteInput): { xpGained; unlockedAchievements };
  submitRecord(kind, value): boolean /* ¿nuevo récord? */;
  completeOnboarding(experience, diagnostic): { level };
  updateSettings(patch: Partial<UserSettings>): void;
  updateProfile(patch: Partial<UserProfile>): void;
  clearMistakes(atomicNumber?: number): void;
  resetProgress(): void;
  exportData(): string; importData(json: string): boolean; }
```
Otros hooks (`src/hooks/`): `useElementMastery(z)` → `{ mastery; tier; progress }` · `useMasteryMap()` → `Record<number, number>` · `useTheme()` → `{ theme; resolvedTheme; setTheme }` · `useHydrated()` · `useCountdown(ms, { onEnd })` → `{ remainingMs; running; start; pause; reset }` · `useResponseTimer()` → `{ start(); elapsed(): number }` · `useSound()` → `{ correct(); wrong(); levelUp(); tick() }` (WebAudio, respeta ajustes) · `useHaptics()` → `{ success(); error() }`.

## Persistencia (src/services/storage)

```ts
interface ProgressRepository { load(): Promise<ProgressState | null>; save(state: ProgressState): Promise<void>; clear(): Promise<void>; }
```
`LocalStorageRepository` (clave `elementa:progress:v1`, validación + migración por `version`). `services/storage/index.ts` exporta la instancia activa: es el único punto a cambiar para usar Supabase/Firebase (ver README).
El tema se guarda además en `localStorage['elementa:theme']` para aplicarlo antes del primer pintado (script inline en `layout.tsx`).

## Sistema de diseño

Tokens en `globals.css` (`@theme`) con variantes oscuras vía clase `.dark` en `<html>` (`@custom-variant dark`).
Clases disponibles: `bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `text-fg`, `text-muted`, `bg-brand`, `text-brand`, `bg-brand-soft`, `text-on-brand`, `bg-success`/`-soft`, `text-success`, `bg-danger`/`-soft`, `text-danger`, `bg-warning`/`-soft`, `text-warning`, `bg-xp`, `text-xp`, `bg-streak`, `text-streak`, y por categoría `bg-cat-<id>`, `bg-cat-<id>-soft`, `border-cat-<id>`, `text-cat-<id>` (ver `data/categories.ts`).
Animaciones: `animate-pop` (acierto), `animate-shake` (error), `animate-fade-in`, `animate-slide-up`, `animate-bounce-in`, `animate-pulse-ring`; se desactivan con `prefers-reduced-motion`.
Tipografía: Nunito (next/font) — títulos en 800/900.
Principios: mobile-first, tarjetas `rounded-3xl`, botones "presionables" con sombra inferior, objetivos táctiles ≥ 44 px, contraste AA en ambos temas, sin saturar la pantalla.

### Primitivas (`components/ui`)
`Button` (`variant`: primary | secondary | ghost | danger | success | outline; `size`: sm | md | lg; `block`; `loading`; `leftIcon`/`rightIcon`) · `ButtonLink` (igual, con `href`) · `Card` (`interactive`, `padding`: none | sm | md | lg) · `ProgressBar` (`value` 0–1, `tone`, `size`, `label`, `showValue`) · `ProgressRing` (`value` 0–1, `size`, `stroke`, children) · `Badge` · `Chip` (`selected`, `onClick`) · `Switch` · `SegmentedControl<T>` (`options`, `value`, `onChange`) · `Modal` (`open`, `onClose`, `title`, móvil = hoja inferior, accesible) · `StatTile` (`icon`, `label`, `value`, `hint`) · `EmptyState` · `Skeleton` · `IconButton` (`label` obligatorio).

### Layout (`components/layout`)
`AppShell` (TopBar + contenido + BottomNav/SideNav) · `PageHeader` (`title`, `subtitle`, `back?: string | true`, `actions`) · `ThemeToggle` (☀️ Claro / 🌙 Oscuro).

### Gamificación (`components/gamification`)
`LevelBar` · `StreakBadge` · `StreakCalendar` · `XpBadge` · `DailyGoalRing` · `MasteryBar` (`value` 0–100, barra tipo ████████░░ con color por nivel) · `MasteryBadge` · `AchievementCard` · `Confetti` · `CelebrationHost` (escucha `progressStore.onEvent`: toasts de XP/logros, modal de subida de nivel, confeti).

### Tabla periódica (`components/periodic`)
`ElementTile` (`element`, `size`: xs | sm | md | lg, `status?`: 'default' | 'selected' | 'correct' | 'incorrect' | 'dimmed' | 'highlight', `showMastery?`, `mastery?`, `onClick?`) ·
`PeriodicTable` (`onSelect?(z)`, `selected?`, `highlighted?`, `dimmed?`, `correct?`, `incorrect?`, `selectable?`, `showMastery?`, `hideLabels?`, `compact?`, `filterCategory?`) — CSS grid 18×10, scroll horizontal en móvil con casillas ≥ 44 px, versión "ajustar a pantalla". ·
`ElementDetail` (ficha completa del elemento + dominio + botones Practicar/Flashcards) · `ElementModal` (`atomicNumber | null`, `onClose`) · `CategoryLegend` (`active?`, `onToggle?`) · `ElementSearch` (`onSelect(z)`, `autoFocus?`).

### Quiz (`components/quiz` + `hooks/useQuizSession.ts`)
`useQuizSession(config)`:
```ts
interface QuizConfig {
  mode: GameMode; title: string;
  questions?: Question[];                         // conjunto fijo (examen, diagnóstico)
  nextQuestion?: (ctx: { index: number; streak: number; asked: number[] }) => Question;  // modos infinitos
  lives?: number;                                 // supervivencia: 3
  timeLimitMs?: number;                           // contrarreloj: 60_000 (global)
  xpFor?: (ctx: { correct: boolean; streak: number; question: Question }) => number | undefined; // override de XP
  autoAdvanceMs?: number;                         // contrarreloj: avanzar sin pulsar "Continuar"
  record?: boolean;                               // registrar en el progreso (default true)
}
returns { status: 'playing' | 'feedback' | 'finished'; current: Question | null; index; total /* null si infinito */;
  lives; streak; bestStreak; correctCount; answered: AnsweredQuestion[]; remainingMs; lastOutcome: AnswerOutcome | null;
  lastAnswer: AnsweredQuestion | null; answer(response: string | number[]): void; next(): void; finish(): void;
  restart(): void; summary: SessionSummaryData | null }
```
Componentes: `QuestionRenderer` (según `kind`) · `QuestionCard` + `OptionButton` (A–D, estados correcto/incorrecto con animación) · `TableQuestion` (tocar casillas; multi con botón "Comprobar") · `FeedbackPanel` (✅ ¡Correcto! +10 XP / ❌ Incorrecto + respuesta correcta + explicación + "Continuar") · `QuizHeader` (progreso, vidas, tiempo, racha, salir) · `QuizScreen` (orquesta todo lo anterior a pantalla completa) · `SessionSummary` (resultado, %, correctas/incorrectas, XP, racha, "Hoy mejoraste", "Elementos que debes repasar", botón "Practicar mis errores").

## Convenciones

- Todo el texto de la interfaz en español neutro, tuteo, frases cortas.
- Componentes interactivos con `'use client'`. Leer progreso solo con `useProgress()`; mientras `ready === false` mostrar `Skeleton` (evita desajustes de hidratación).
- Nada de `Math.random()` durante el render del servidor; generar preguntas en efectos/handlers o tras `ready`.
- Ningún botón sin acción. Accesibilidad: roles, `aria-label`, foco visible, navegación por teclado (1–4 / A–D para responder, Enter para continuar).
- Imports con alias `@/…`. Sin `any`. Archivos pequeños y con una responsabilidad.
