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
    pwa/                  ServiceWorkerRegister, InstallPrompt, AppIcon, hooks de instalación/conexión
    <feature>/            Componentes propios de una página: dashboard/, onboarding/, hub/, settings/, learn/ (estudiar,
                          aprende, bloques), flashcards/, games/ (preguntados, racha, contrarreloj, supervivencia),
                          exam/, practice/, visual/, mistakes/, stats/ (+ charts/), achievements/
  data/                   Datos estáticos: elements.ts (118), categories.ts, levels.ts, achievements.ts, blocks.ts
  types/                  Contratos compartidos (element.ts, progress.ts, quiz.ts)
  utils/                  Lógica pura, sin React (motor de aprendizaje, preguntas, formato…)
  hooks/                  Hooks de React
  store/                  Estado global del progreso (store externo + Provider)
  services/storage/       Repositorio de persistencia (localStorage hoy)
  services/               theme.ts, sound.ts (WebAudio), haptics.ts
public/
  sw.js, icons/           PWA (iconos generados con `npm run icons` desde scripts/icon-art.mjs)
```
PWA en `app/`: `manifest.ts` (→ `/manifest.webmanifest`), `icon.svg`, `apple-icon.png`, `favicon.ico`, `offline/`.

## Rutas

| Ruta | Pantalla |
|---|---|
| `/` | Inicio (dashboard). Si `profile.onboarded === false` redirige a `/bienvenida`. |
| `/bienvenida` | Primer uso: nivel de experiencia + diagnóstico de 10 preguntas → nivel inicial. `?repetir=1` va directo al paso 2 (repetir diagnóstico). |
| `/estudiar` | "Estudiar ahora": sesión inteligente (nuevos + repasos + difíciles). |
| `/aprende` | "Aprende 5": 5 elementos nuevos, uno por uno, y luego preguntas de comprobación. `?block=<id>` o `?family=<category>` limita los elementos. |
| `/tabla` | Tabla periódica interactiva + buscador. `?e=<Z>` abre la ficha del elemento; `?family=<category>` abre con esa familia filtrada. |
| `/flashcards` | Flashcards con repetición espaciada (7 modos). `?elements=1,2,3` limita el mazo (y empieza directamente); `?mode=<modo>` elige el modo. |
| `/preguntados` | Trivia estilo Preguntados con ruleta de categorías. |
| `/examen` | Mini exámenes: rápido (10), normal (20), completo (50), personalizado (`?tipo=personalizado`). |
| `/contrarreloj` | 60 segundos: máximo de aciertos. Récord personal. |
| `/supervivencia` | 3 vidas ❤️❤️❤️. Récord personal. |
| `/racha` | Preguntas encadenadas con multiplicador y bonus x5/x10/x20. |
| `/visual` | Preguntas sobre la tabla: tocar casillas, selección múltiple. |
| `/practicar` | Práctica genérica. `?focus=errores|dificiles|repaso`, `?elements=19,26`, `?block=<id>`, `?family=<category>`, `?n=10`, `?types=<tipo>,…`. Prioridad: elements > block > family > focus; sin parámetros, menú. |
| `/bloques` | Aprender por bloques (1–10, 11–20…) y por familias (`?vista=familias`). |
| `/errores` | Mis errores: elementos más difíciles + preguntas falladas. |
| `/estadisticas` | Dashboard de estadísticas y gráficas. |
| `/logros` | Logros desbloqueables. |
| `/jugar` | Hub de todos los modos de juego. |
| `/ajustes` | Tema, meta diaria, sonido, exportar/importar/reiniciar progreso. |
| `/offline` | Página de respaldo del service worker (ya existe). |

Navegación (`components/layout/nav-items.ts`): barra inferior en móvil (Inicio, Tabla, Jugar, Progreso=`/estadisticas`, Ajustes) y barra lateral en escritorio (≥ lg) con esos destinos + accesos rápidos (Flashcards, Examen, Mis errores, Logros). Cada destino marca como activas sus subrutas (`match`: p. ej. `/examen` activa «Jugar»).
Todas las rutas de la tabla existen (más la 404, `not-found.tsx`) y `public/sw.js` las precachea en `APP_ROUTES`. Toda ruta con `useSearchParams` envuelve su pantalla en `<Suspense>`.

## Modelo de datos

Ver `src/types/*.ts` (fuente de verdad). Resumen:

- `ChemicalElement`: datos del elemento (numéricos verificados + textos en español).
- `ProgressState`: todo lo persistido (perfil, ajustes, XP, progreso por elemento, errores, actividad diaria, récords, logros).
- `ElementProgress`: aciertos/fallos, racha, tiempos, SRS (ease, interval, due), aprendido.
- `Question`: pregunta generada (opción múltiple o de tabla) con explicación. `QuestionGenOptions`, `AnsweredQuestion`, `AnswerOutcome`, `SessionSummaryData` también viven en `src/types`.
- Tipos que NO están en `src/types` (se definen junto a quien los produce): `LevelInfo` (utils/levels), `StreakInfo`/`WeekDay` (utils/streak), `StudyPlan` (utils/planner), `AchievementDef`/`AchievementContext` (data/achievements), `StudyBlock`/`FamilyGroup` (data/blocks), `CategoryMeta` (data/categories).

## Motor (src/utils) — funciones puras

Nunca leen `localStorage` ni usan React. Reciben `now: Date` cuando dependen del tiempo.

### `random.ts`
`type Rng = () => number` (último parámetro opcional de todas, por defecto `Math.random`) · `shuffle<T>(arr, rng?): T[]` (copia) · `sample<T>(arr, n, rng?): T[]` · `pick<T>(arr, rng?): T` · `weightedSample<T>(items, weights, n, rng?): T[]` (sin reemplazo) · `randomInt(min, max, rng?)` · `uid(): string`

### `dates.ts` (días en hora local, claves `YYYY-MM-DD`)
`dateKey(d): string` · `todayKey(now = new Date()): string` · `keyToDate(key): Date` · `isDateKey(key): boolean` · `addDays(key, n): string` · `daysBetween(a, b): number` · `lastNDays(n, endKey = todayKey()): string[]` (antiguo→reciente) · `weekKeys(key): string[]` (lunes→domingo) · `weekdayIndex(key)` (lunes = 0) · `WEEKDAY_LETTERS = ['L','M','M','J','V','S','D']` · `weekdayLetter(key): string`

### `format.ts`
`formatMass(el): string` ("15.999"; "[98]" si `massIsMassNumber`) · `formatConfig(cfg): string` (superíndices: "[He] 2s² 2p⁴"; los datos están en orden de llenado, p. ej. "[Xe] 6s¹ 4f¹⁴ 5d¹⁰") · `formatNumber(n)` (es-MX, "1,482") · `formatPercent(ratio0to1)` ("82%") · `formatDuration(ms)` ("45 s", "3 min 20 s", "7 h 32 min") · `groupLabel(el)` ("Grupo 1" / "Bloque f") · `phaseLabel(phase)` · `categoryLabel(cat, plural = false)` (singular "Gas noble" / plural "Gases nobles") · `normalizeText(s)` (minúsculas sin acentos) · `pluralize(n, singular, plural): string` → **solo la palabra**: `` `${n} ${pluralize(n, 'elemento', 'elementos')}` ``

### `table-layout.ts`
`getGridPosition(el): GridPosition /* { col; row } */` → col 1–18; filas 1–7 tabla principal, 8 separador, 9 lantánidos (57–71, col 3–17), 10 actínidos (89–103, col 3–17).
`F_BLOCK_PLACEHOLDERS = { lanthanides: { col: 3, row: 6, label: '57–71' }, actinides: { col: 3, row: 7, label: '89–103' } }` · `GRID_COLUMNS = 18` · `GRID_ROWS = 10`
`getNeighbor(el, dir: 'up'|'down'|'left'|'right'): ChemicalElement | null` (solo tabla principal) · `elementAt(col, row)` · `isInFBlockRow(el)`

### `search.ts`
`searchElements(query, limit = 8): ChemicalElement[]` — símbolo exacto ("Au", sin distinguir mayúsculas), número ("79"), nombre o `altNames` sin acentos ("oro", "tungsteno"; prefijo antes que subcadena).

### `levels.ts` (+ `data/levels.ts`: `LEVEL_TITLES`, `LEVEL_EMOJIS`, `MAX_TITLED_LEVEL`)
XP para pasar del nivel n al n+1: `100 + (n − 1) × 150` (N1: 100, N7: 1000).
Títulos: 1 Aprendiz · 2 Explorador · 3 Químico Junior · 4 Químico · 5 Experto · 6 Maestro de los Elementos · 7 Gran Maestro · 8 Leyenda Atómica · 9+ Mente Cuántica.
`xpToNext(level)` · `xpAtLevelStart(level)` · `levelTitle(level)` · `levelEmoji(level)` (🌱…🌌) · `levelFromXp(xp): LevelInfo`
`interface LevelInfo { level; title; xpIntoLevel; xpForNext; progress /* 0–1 */; totalXp }`

### `xp.ts`
`XP_RULES = { correct: 10, hardCorrect: 15, examComplete: 50, perfectExam: 100, learnElement: 5, flashcard: { again: 1, hard: 3, good: 5, easy: 5 }, sessionComplete: 20 }`
`xpForAnswer(correct, difficulty = 1): number` (0 si falla; 15 si difficulty 3; 10 si no)
`streakMultiplier(streak)` · `streakModeXp(streak): { xp; bonus; milestone: 5|10|20|null; multiplier }` — `streak` es la racha **tras** el acierto (1 = primero). x1 (1–4), x1.5 (5–9), x2 (10–19), x3 (20+) sobre 10 XP; bonus +25 al llegar a 5, +50 a 10, +150 a 20 y +100 en cada múltiplo de 10 posterior (incluido en `xp`).

### `mastery.ts`
`computeMastery(p: ElementProgress | undefined, now): number` (0–100, entero): precisión bayesiana, precisión reciente (últimos 10), confianza por nº de respuestas (plena ~6), velocidad (`avgResponseMs` ≤ 4 s sin penalización, ≥ 12 s −15 %) y olvido (decae pasado el `due`).
`masteryTier(m): MasteryTier` → `practice` < 40 ≤ `learning` < 65 ≤ `almost` < 85 ≤ `mastered` · `MASTERED_THRESHOLD = 85`
`TIER_META: Record<MasteryTier, { label; emoji; barClass; textClass }>` — 🔴 Necesita práctica · 🟠 Aprendiendo · 🟡 Casi dominado · 🟢 Dominado
`masteryMap(state, now): Record<number, number>` (los 118) · `countMastered(state, now)` · `countLearned(state)`

### `srs.ts` (SM-2 simplificado)
`createElementProgress(z)` · `applyRating(p, rating, now)` (again → reps 0, intervalo 0, due +10 min, ease −0.2; hard → intervalo ×1.2 (mín. 1 d), ease −0.15; good → 1 d, 3 d, luego ×ease; easy → 4 d o ×ease×1.3, ease +0.15; ease ∈ [1.3, 3.0]; intervalo máx. 365 d) · `ratingFromAnswer(correct, responseMs)` (fallo → again; > 10 s → hard; < 3 s → easy; si no good) · `isDue(p, now)` · `overdueDays(p, now)`

### `engine.ts` — transiciones del estado (inmutables)
```ts
interface AnswerInput { atomicNumber; skill: QuestionSkill; correct: boolean; responseMs: number; mode: GameMode;
  prompt: string; correctAnswer: string; givenAnswer: string; difficulty?: 1|2|3; xpOverride?: number }
interface FlashcardInput { atomicNumber; skill: QuestionSkill; rating: FlashcardRating; responseMs: number }
interface SessionCompleteInput { mode: GameMode; total: number; correct: number; durationMs: number; isExam?: boolean }
type RecordKind = 'timeAttack' | 'survival' | 'streakMode'
createInitialState(now): ProgressState · emptyDay(date, goal): DailyActivity
applyAnswer(state, input, now): { state; outcome: AnswerOutcome }
applyFlashcard(state, input, now): { state; outcome: AnswerOutcome }
applyLearned(state, zs, now): { state; xpGained; unlockedAchievements }            // +5 XP por elemento nuevo
applyXp(state, amount, now): { state; leveledUp; newLevel; unlockedAchievements }
applySessionComplete(state, input, now): { state; xpGained; unlockedAchievements; leveledUp; newLevel } // +20 sesión, +50 examen, +100 perfecto
applyRecord(state, kind, value, now): { state; isNewRecord; unlockedAchievements }
applyOnboarding(state, experience, diagnostic: AnsweredQuestion[], now): { state; level; unlockedAchievements }
applySettings(state, patch, now) · applyProfile(state, patch, now) · applyClearMistakes(state, z | undefined, now)
applyReset(state, now)            // conserva los ajustes · diagnosticLevel(correct, total, experience) · collectUnlocked(before, after)
```
Reglas: la actividad diaria (`daily[todayKey]`) marca `goalMet` cuando `questions >= settings.dailyGoal`. Cada fallo añade un `MistakeRecord` (máx. 300, reciente primero).
- SRS en respuestas: un fallo siempre reprograma; un acierto solo avanza el intervalo si el elemento es nuevo o ya tocaba repasarlo.
- Flashcards: cuentan para la meta diaria y `flashcardsReviewed`, **no** para `stats.totalQuestions`, la racha global de aciertos ni los errores.
- `applyOnboarding` registra él mismo las respuestas del diagnóstico (sin añadirlas a errores): el quiz de `/bienvenida` debe usar `record: false`.

### `streak.ts`
Un día cuenta para la racha cuando se cumple la meta diaria.
`computeStreak(daily, todayKey): StreakInfo` → `{ current; best; todayMet; atRisk /* ayer cumplido, hoy aún no */ }` (la racha sigue viva si ayer se cumplió)
`weekActivity(daily, todayKey): WeekDay[]` → `{ key; letter; goalMet; active; isToday; isFuture }` (lunes→domingo)

### `achievements.ts` (+ `data/achievements.ts`)
`ACHIEVEMENTS: AchievementDef[]` (24) y `ACHIEVEMENTS_BY_ID` · `AchievementDef = { id; emoji; title; description; progress(ctx: AchievementContext): { current; target } }`
`AchievementContext = { state; now; mastery; masteredCount; learnedCount; level; bestDayStreak }` · `buildAchievementContext(state, now)`
`evaluateAchievements(state, now): string[]` (ids recién cumplidos, no presentes en `state.achievements`)
`achievementStatuses(state, now): AchievementStatus[]` → `{ def; unlocked; unlockedAt: string | null; current; target; ratio /* 0–1 */ }` (para `/logros`)
Ids: first-element, ten-learned, first-block, first-goal, on-fire (7 días), unstoppable, ten-mastered, half-way (59), table-master (118), atomic-memory (50 seguidos), chemical-speed (20 en contrarreloj), survivor, chain-reaction, first-exam, ten-exams, perfect-exam, noble-gases, halogens, alkali-metals, level-5, level-9, questions-100, questions-1000, flashcards-100.

### `questions.ts` — generador de preguntas
```ts
QUESTION_TYPE_META: Record<QuestionType, { label; skill: QuestionSkill; kind: QuestionKind; topic: ExamTopic }>
MC_TYPES · TABLE_TYPES · ALL_QUESTION_TYPES: QuestionType[]
isApplicable(type, el): boolean
generateQuestion(type, atomicNumber): Question | null
generateQuestions(opts: QuestionGenOptions, state?: ProgressState, now = new Date()): Question[]
generateAdaptiveQuestion(state, now, opts?: AdaptiveQuestionOptions): Question   // siempre devuelve una (modos infinitos)
interface AdaptiveQuestionOptions { types?: QuestionType[]; pool?: number[]; exclude?: number[]; maxDifficulty?: 1|2|3 }
typesForTopics(topics: ExamTopic[]): QuestionType[]
checkTableAnswer(q, selected: number[]): boolean
describeTableSelection(selected: number[]): string   // "Na, K" o "—" (para givenAnswer)
questionSignature(q): string                         // tipo + subject + enunciado: "la misma pregunta"
```
`generateQuestions` nunca repite tipo+elemento ni enunciado (`questionSignature`: varios elementos comparten «Selecciona todos los gases nobles»). Con `uniqueElements` vuelve a recorrer el pool si descarta alguno, así que puede repetir elemento: quien necesite elementos únicos debe filtrarlos. **Un `pool` vacío significa los 118** (igual que `typesForTopics([])` → todos los tipos de opción múltiple): comprobar antes de llamar si el vacío debe dar cero preguntas.
`checkTableAnswer`: `table-select` → exactamente UNA casilla y dentro de `targetAtomicNumbers` (en `table-group-member` todos los del grupo son objetivo); `table-multi-select` → conjunto exacto (sin orden ni duplicados); opción múltiple → `false`.
Reglas: 4 opciones únicas y una correcta; distractores plausibles; explicaciones cortas; nunca preguntas ambiguas.

### `planner.ts` — algoritmo de aprendizaje (+ `selection.ts`, `difficulty.ts`)
```ts
elementPriority(p | undefined, now): number          // fallos (mayor peso) + retraso sobre due + nuevos + lentos
weakElements(state, now, limit?): Array<{ atomicNumber; mastery }>   // intentados no dominados, menor dominio primero
dueReviews(state, now, n): number[]
newElements(state, n, pool?): number[]              // no aprendidos, en orden atómico
adaptivePool(state, now, n, pool?): number[]        // muestreo ponderado por prioridad
planStudySession(state, now, opts?: StudyPlanOptions /* { newCount = 5; reviewCount = 10; hardCount = 5 } */): StudyPlan
interface StudyPlan { newElements: number[]; reviews: number[]; hard: number[]; questions: Question[]; estimatedMinutes: number }
```
Si el usuario es nuevo y no hay repasos/difíciles, el plan se completa con nuevos/recientes (nunca vacío). `utils/selection.ts` exporta además `ALL_ATOMIC_NUMBERS` (1–118); `utils/difficulty.ts`: `elementDifficulty(elOrZ): 1|2|3`.

### Datos (`src/data`)
- `elements.ts`: `ELEMENTS`, `ELEMENTS_BY_NUMBER`, `ELEMENTS_BY_SYMBOL`, `getElement(z)`, `TOTAL_ELEMENTS`.
- `categories.ts`: `CATEGORIES: Record<ElementCategory, CategoryMeta>` con `{ id; label /* plural */; singular; emoji; blurb; tileClass; solidClass; textClass }`, `CATEGORY_ORDER`, `PHASE_LABELS`, `PHASE_EMOJI`, `metallicCharacter(cat)`. `tileClass` = fondo suave + borde + `text-fg`; `solidClass` = fondo sólido + texto legible en ambos temas.
- `blocks.ts`: `STUDY_BLOCKS: StudyBlock[]` (`{ id: 'b1'…'b12'; title: 'Bloque 1'; range: '1–10'; from; to; atomicNumbers }`, el último 111–118) · `FAMILY_GROUPS: FamilyGroup[]` (`{ id = category; category; title; emoji; blurb; atomicNumbers }`, en `CATEGORY_ORDER`) · `getStudyBlock(id)` · `getFamilyGroup(id)`.

## Estado global (src/store)

Store externo sin dependencias + `useSyncExternalStore`.
- `progress-store.ts`: `progressStore: ProgressStore` = `{ getState(); getServerSnapshot() /* DEFAULT_PROGRESS_STATE: fecha 0, misma referencia siempre */; subscribe(fn); isReady(); hydrate(); onEvent(fn): () => void; flush(): Promise<void>; ...ProgressActions }`.
  - `ProgressEvent = { type: 'xp'; amount } | { type: 'levelUp'; level } | { type: 'achievement'; id } | { type: 'goalMet' }`.
  - Guardado con *debounce* de 300 ms, `flush` en `visibilitychange`/`pagehide`; nunca guarda antes de cargar. Escucha cambios de otras pestañas (`repository.watch`).
  - Un progreso nuevo (nada guardado) toma el tema de `localStorage['elementa:theme']`.
  - `completeOnboarding` no emite eventos `xp`/`levelUp`; `resetProgress`/`importData` guardan al instante.
  - `createProgressStore(repo, { saveDelayMs?, now?, initialSettings? })` para pruebas.
- `ProgressProvider.tsx` ('use client', ya montado en `layout.tsx`): carga el estado al montar y sincroniza el tema. `useProgressContext(): { ready }`.

### Hooks (`src/hooks`, todos 'use client')
```ts
useProgress(): { state; ready; level: LevelInfo; streak: StreakInfo; today: DailyActivity; ...ProgressActions }  // acciones estables
// ProgressActions:
recordAnswer(input: AnswerInput): AnswerOutcome
rateFlashcard(input: FlashcardInput): AnswerOutcome
markLearned(atomicNumbers: number[]): { xpGained; unlockedAchievements }
addXp(amount: number): void
completeSession(input: SessionCompleteInput): { xpGained; unlockedAchievements }
submitRecord(kind: RecordKind, value: number): { isNewRecord; unlockedAchievements }
completeOnboarding(experience: ExperienceLevel, diagnostic: AnsweredQuestion[]): { level }
updateSettings(patch: Partial<UserSettings>): void
updateProfile(patch: Partial<UserProfile>): void
clearMistakes(atomicNumber?: number): void
resetProgress(): void                                       // conserva ajustes
exportData(): string
importData(json: string): boolean                           // rechaza JSON sin `version` + `profile`
```
Antes de `ready`, `state` es el estado por defecto y `today`/`streak` usan un día fijo: mostrar `Skeleton`.
- `useProgressState(): ProgressState` · `useProgressReady(): boolean` · `useNow(): Date` (se actualiza cada minuto; fecha 0 en SSR/hidratación)
- `useElementMastery(z): { mastery; tier; progress: ElementProgress | undefined }` · `useMasteryMap(): Record<number, number>`
- `useTheme(): { theme: ThemePreference; resolvedTheme: 'light'|'dark'; setTheme(t) }` (guarda en ajustes + `localStorage['elementa:theme']`)
- `useHydrated(): boolean` (false en SSR e hidratación)
- `useCountdown(durationMs, { onEnd? }): { remainingMs; running; start(); pause(); reset(ms?) }`
- `useResponseTimer(): { start(); elapsed(): number }`
- `useSound(): { correct(); wrong(); levelUp(); tick() }` (WebAudio, respeta `settings.sound`) · `useHaptics(): { success(); error() }` (respeta `settings.haptics`)
- `useQuizSession(config)` → ver Quiz.

## Persistencia (src/services)

```ts
interface ProgressRepository {
  load(): Promise<ProgressState | null>; save(state): Promise<void>; clear(): Promise<void>;
  watch?(onChange: (state: ProgressState | null) => void): () => void;   // cambios externos (otra pestaña)
}
```
`services/storage/index.ts` exporta la instancia activa `progressRepository` (único punto a cambiar para Supabase/Firebase) y `LocalStorageRepository` (clave `PROGRESS_STORAGE_KEY = 'elementa:progress:v1'`, validación + migración por `version`), `MemoryRepository`, `parseProgressState(input, now?)`, `parseProgressJson(json, now?)`, `THEME_STORAGE_KEY = 'elementa:theme'`, `getLocalStorage()`.
`services/theme.ts`: `THEME_INIT_SCRIPT` (script inline de `layout.tsx`, aplica `.dark` antes del primer pintado), `readStoredTheme`, `writeStoredTheme`, `resolveTheme`, `applyResolvedTheme`, `systemPrefersDark`. `services/sound.ts` (`playSound(name)`), `services/haptics.ts` (`vibrate(pattern)`): úsense vía hooks.

## Sistema de diseño

Tokens en `globals.css` (`@theme`) con variantes oscuras vía clase `.dark` en `<html>` (`@custom-variant dark`).
Colores: `bg`, `surface`, `surface-2`, `border`, `border-strong`, `fg`, `muted`, `overlay`, `brand`/`brand-shade`/`brand-soft`/`on-brand`, `accent`/`accent-soft`, `success`/`-shade`/`-soft`/`on-success`, `danger`/`-shade`/`-soft`/`on-danger`, `warning`/`-soft`/`on-warning`, `xp`/`xp-soft`/`xp-glow`, `streak`/`streak-soft`/`streak-glow`, y por categoría `cat-<id>`, `cat-<id>-soft` (ver `data/categories.ts`). Sombras `shadow-card|float|glow`.
**Texto sobre rellenos sólidos**: usar `text-on-brand|on-success|on-danger|on-warning`, nunca `text-white` (en oscuro los rellenos son claros).
Utilidades: `pressable` (sombra inferior, `[--press-shade:…]`), `pt/pb/pl/pr/px-safe`, `top-safe`, `bottom-safe`, `no-scrollbar`, `scroll-contained`, `perspective-card`, `preserve-3d`, `face-hidden`, `flip-y` (flashcards), `tabular`, `shimmer`, `bg-brand-gradient`, `text-brand-gradient`.
Animaciones `animate-*`: pop, shake, fade-in/out, slide-up/down, sheet-up/down, zoom-in/out, bounce-in, pulse-ring (`--pulse-color`), float, float-up, wiggle, shimmer, confetti-fall; se desactivan con `prefers-reduced-motion`.
Tipografía: Nunito (next/font, `font-sans`) — títulos en 800/900.
Principios: mobile-first, tarjetas `rounded-3xl`, objetivos táctiles ≥ 44 px, contraste AA en ambos temas. Un elemento `sr-only` dentro de un contenedor con scroll horizontal necesita un ancestro `relative` (si no, ensancha la página en móvil); una `<table>` no se encoge con `sr-only`: envolverla en un `div.sr-only`.
Rejillas responsive: poner siempre la base `grid-cols-1` (`grid grid-cols-1 lg:grid-cols-2`). Sin ella la columna implícita mide lo que su contenido mínimo (p. ej. una mini tabla con `aspect-square`) y en móvil la página se ensancha.

Todos los componentes usan exports con nombre; cada carpeta tiene `index.ts` (barrel).

### Primitivas (`@/components/ui`)
- `Button`: props de `<button>` + `variant?: 'primary'|'secondary'|'ghost'|'danger'|'success'|'outline'|'inverse'` (`inverse`: claro sobre fondos de marca/degradados), `size?: 'sm'|'md'|'lg'` (≥ 44 px), `block?`, `loading?`, `leftIcon?`, `rightIcon?`. `ButtonLink`: props de `next/link` + los mismos estilos. `buttonClasses(opts)`.
- `Card`: `interactive?`, `padding?: 'none'|'sm'|'md'|'lg'`, `tone?: 'default'|'soft'|'brand'`, `as?: 'div'|'section'|'article'|'aside'|'li'` + props HTML (sin `ref`).
- `ProgressBar`: `value` (0–1), `tone?`, `size?: 'sm'|'md'|'lg'`, `label?`, `showValue?`, `valueText?`, `ariaLabel?`. `ProgressRing`: `value` (0–1), `size?` (px, 56), `stroke?`, `tone?`, `label?` (lo expone como progressbar), `children?`, `trackClassName?`.
- `Tone = 'brand'|'success'|'danger'|'warning'|'xp'|'streak'|'accent'|'neutral'`; mapas `TONE_TEXT|SOFT|SOLID|STROKE|FILL`.
- `Badge`: `tone?`, `variant?: 'soft'|'solid'`, `size?: 'sm'|'md'`, `icon?`. `Chip`: `selected?`, `onClick?` (con él es un conmutador `aria-pressed`; sin él, etiqueta), `icon?`, `size?: 'sm'|'md'`.
- `Switch`: `checked`, `onChange(checked)`, `label`, `description?`, `disabled?`, `hideLabel?`, `id?` (`role="switch"`).
- `SegmentedControl<T extends string|number>`: `options: { value; label; icon?; ariaLabel?; disabled? }[]`, `value: T | null | undefined`, `onChange(v)`, `label` (obligatorio), `size?: 'sm'|'md'`, `block?`. Flechas/Inicio/Fin.
- `Modal`: `open`, `onClose`, `title`, `description?`, `children?`, `footer?`, `size?: 'sm'|'md'|'lg'`, `hideTitle?`, `showClose?`, `dismissible?`, `initialFocusRef?`. Hoja inferior en móvil, centrado desde `sm`. Con un modal abierto `<html>` lleva `data-modal-open`; `isModalOpen()`.
- `StatTile`: `icon?`, `label`, `value`, `hint?`, `tone?`. `EmptyState`: `icon?`, `title`, `description?`, `action?`. `Skeleton`: `rounded?` + props de div (tamaño con `className`).
- `IconButton`: `label` (obligatorio), `icon`, `variant?: 'ghost'|'soft'|'secondary'|'primary'`, `size?: 'sm'|'md'|'lg'`. `IconLink`: igual con `href`.
- Utilidades: `cn(...)` (solo concatena: **no** resuelve clases de Tailwind en conflicto, así que `className` no sirve para sobrescribir p. ej. el `mb-5` de un componente; usar props o envolver), `clamp01`, `useReducedMotion()`.

### Layout (`@/components/layout`)
- `AppShell` (ya montado en `layout.tsx` dentro de `ChromeProvider`): TopBar (solo < lg) + contenido (`max-w-5xl`) + BottomNav (< lg) / SideNav (≥ lg, con nivel, racha y tema). `immersive?: boolean` lo fuerza.
- **Modo inmersivo** (sin navegación; contenido centrado `max-w-3xl` en un contenedor `flex flex-col`, así que la pantalla puede usar `flex-1`):
  - `useImmersive(active = true)`: mientras el componente esté montado y `active`. Es lo que usa `QuizScreen`.
  - `useChrome(): { immersive; setImmersive(v); acquireImmersive(): () => void }`; `setImmersive(true)` se desactiva solo al cambiar de ruta.
  - `IMMERSIVE_ROUTES = ['/bienvenida']` (siempre inmersiva). `ChromeProvider` ya está en `layout.tsx`.
- `PageHeader`: `title`, `subtitle?`, `back?: string | true` (true = historial), `backLabel?`, `actions?`, `eyebrow?`.
- `ThemeToggle`: `variant?: 'segmented'|'icon'` (☀️ Claro / 🌙 Oscuro / 💻 Sistema; lo usa Ajustes), `size?`, `block?`. `Logo` (`compact?`), `LogoMark`. `TopBar`, `BottomNav`, `SideNav`, `UserStats` (`className?`).
- `MAIN_NAV`, `QUICK_NAV: NavItem[]` (`{ href; label; icon; match? }`), `navState(item, pathname): 'page'|'section'|null`.

### Gamificación (`@/components/gamification`)
Leen `useProgress()` por defecto (Skeleton hasta `ready`); todo valor se puede pasar por prop.
- `LevelBar` (`level?: LevelInfo`, `compact?`) · `LevelEmblem` (`level: number`, `size?: 'sm'|'md'|'lg'|'xl'`)
- `StreakBadge` (`count?`, `active?`, `size?: 'sm'|'md'|'lg'`, `showLabel?`) · `StreakCalendar` (`daily?`, `today?`)
- `XpBadge` (`value?`, `plus?`, `size?`, `variant?: 'soft'|'solid'`) · `XpFloat` (`amount`)
- `DailyGoalRing` (`size?` = 88, `stroke?`, `showLabel?`, `done?`, `goal?`)
- `MasteryBar` (`value` 0–100, `segments?` = 10, `showValue?`, `showLabel?`, `size?: 'sm'|'md'`) · `MasteryBadge` (`value?` o `tier?`, `showEmoji?`, `size?`)
- `AchievementCard` (`emoji`, `title`, `description`, `unlocked`, `unlockedAt?`, `current?`, `target?`) — acepta `{...def}` de `ACHIEVEMENTS`.
- `Confetti` (`pieces?`, `duration?`, `origin?: 'top'|'center'`, `onDone?`; nada con movimiento reducido) · `LevelUpModal` (`open`, `level`, `onClose`)
- `CelebrationHost` (sin props, ya montado en `layout.tsx`): escucha `progressStore.onEvent` → "+N XP" flotante, avisos de logros y meta diaria, modal de nivel con confeti (en modo inmersivo, un aviso) y sonido de nivel. Las páginas NO deben celebrar XP/logros/nivel por su cuenta.

### Tabla periódica (`@/components/periodic`)
- `ElementTile` (memo): `element`, `size?: 'xs'|'sm'|'md'|'lg'`, `status?: TileStatus` ('default'|'selected'|'correct'|'incorrect'|'dimmed'|'highlight'), `showMastery?`, `mastery?`, `onClick?(z)` (sin él es una figura estática), `fluid?`, `blind?` (sin texto), `neutral?` (sin color de familia), `pressed?`, `decorative?`, `tabIndex?`, `style?`, `className?`.
- `PeriodicTable` (memo): `onSelect?(z)`, `selected?`, `highlighted?`, `dimmed?`, `correct?`, `incorrect?` (`readonly number[]`), `selectable?: boolean | readonly number[]` (el resto se atenúa), `showMastery?`, `hideLabels?` (**oculta los números de grupo/periodo**, no el texto de las casillas), `compact?` (controlado por el padre; ajusta al ancho), `filterCategory?: ElementCategory | null`, `blind?`, `neutral?`, `label?`, `bleed?` (móvil: scroll hasta el borde, por defecto true). Scroll horizontal en móvil con casillas ≥ 44 px (táctil); flechas del teclado con un solo punto de tabulación; la primera `highlighted`/`correct` (o, si no hay, el primer elemento de `filterCategory`) se desplaza a la vista.
- `FitToggle` (`compact`, `onChange(compact)`, `size?`): chip «Ajustar a pantalla».
- `ElementDetail` (`atomicNumber`, `onNavigate?(z)`, `showPager?`, `titleAs?: 'h1'|'h2'|'p'`): ficha completa + dominio + ubicación + botones Practicar (`/practicar?elements=Z`) y Flashcards (`/flashcards?elements=Z`).
- `ElementModal` (`atomicNumber: number | null`, `onClose()`, `onNavigate?(z)`). En `/tabla` el elemento abierto vive en `?e=<Z>` (pushState: «atrás» cierra la ficha).
- `CategoryLegend` (`active?`, `onToggle?(cat)`, `showCounts?`, `layout?: 'scroll'|'wrap'`) · `ElementSearch` (`onSelect(z)`, `autoFocus?`, `onResultsChange?(zs)`, `placeholder?`, `limit?`; combobox accesible) · `MasteryLegend`.
- También: `ElementFacts`, `ElementNotes`, `ElementLocation` (`{ element }`), `ElementMasteryPanel` (`{ atomicNumber }`), `ElementPager` (`atomicNumber`, `onNavigate?`; sin él enlaza a `/tabla?e=Z`), `ALL_ATOMIC_NUMBERS`, `positionLabel(el)`.

### Quiz (`@/components/quiz` + `@/hooks/useQuizSession`)
```ts
useQuizSession(config: QuizConfig): QuizSession
interface QuizConfig {
  mode: GameMode; title: string;
  questions?: Question[] | (() => Question[]);   // conjunto fijo; usar una FUNCIÓN (se llama en el cliente al empezar y en cada restart)
  nextQuestion?: (ctx: { index; streak; asked: number[] }) => Question;   // modos infinitos
  lives?: number;                  // supervivencia: 3
  timeLimitMs?: number;            // contrarreloj: 60_000 (global)
  xpFor?: (ctx: { correct; streak /* tras la respuesta */; question }) => number | undefined;
  autoAdvanceMs?: number;
  record?: boolean;                // registrar en el progreso (default true; false en /bienvenida)
  onFinish?: (ctx: { reason: 'completed'|'lives'|'time'|'manual'; answered; correct; total; bestStreak; durationMs })
    => Partial<Pick<SessionSummaryData, 'newRecord' | 'title' | 'unlockedAchievements'>> | void;
    // p. ej. submitRecord → { newRecord, unlockedAchievements } (los logros se suman a los de la sesión)
}
interface QuizSession {
  ready; status: 'playing'|'feedback'|'finished'; mode; title; current: Question | null; index;
  total: number | null; lives: number | null; maxLives: number | null; streak; bestStreak; correctCount;
  answered: AnsweredQuestion[]; remainingMs: number | null; timeLimitMs: number | null; autoAdvanceMs: number | null;
  lastOutcome: AnswerOutcome | null; lastAnswer: AnsweredQuestion | null; response: string | number[] | null; willFinish: boolean;
  answer(r: string | number[]): void; next(): void; finish(): void; restart(): void;   // estables
  summary: SessionSummaryData | null;
}
```
La primera pregunta se genera en el cliente tras cargar el progreso (`ready`); nunca generar preguntas durante el render. Con `record` el hook llama a `recordAnswer` y, al terminar, a `completeSession` (`isExam` si `mode === 'exam'`); también reproduce sonido y vibración de acierto/fallo.
Componentes:
- `QuizScreen` (`session`, `onExit()`, `renderTop?(session)`, `renderSummary?(summary, session)`, `exitCopy?: { description?; stayLabel? }`): pantalla completa (usa `useImmersive()`): cabecera, pregunta, feedback, confirmación de salida, atajos 1–4/A–D y Enter, y `SessionSummary` al final.
- `SessionSummary` (`summary`, `onRestart?`, `homeHref?` = '/', `onPracticeMistakes?(zs)`): %, correctas, XP, mejoras, "Elementos que debes repasar" y «Practicar mis errores» (enlace a `/practicar?elements=…`, o el callback si ya estás en `/practicar`). Sus piezas también se exportan: `SummaryScore`, `SummaryAchievements` (`ids`), `ImprovedList`, `ReviewList` (`atomicNumbers`).
- `QuestionRenderer` (`question`, `locked`, `response`, `onAnswer(r)`) · `QuestionCard` (`question`, `selectedId`, `locked`, `onAnswer(id)`) · `TableQuestion` (`question`, `locked`, `response: number[] | null`, `onAnswer(zs)`; multi con «Comprobar»; en escritorio la tabla desborda la columna inmersiva con `lg:-mx-8` para verse entera)
- `OptionButton` (`letter`, `label`, `sublabel?`, `state?: 'idle'|'selected'|'correct'|'incorrect'|'disabled'`, `onClick?`, `disabled?`, `shortcut?`) · `QuestionPrompt` (`question`, `headingId?`, `hint?`)
- `FeedbackPanel` (`correct`, `xpGained?`, `bonusXp?`, `correctAnswer`, `explanation?`, `onContinue`, `continueLabel?`, `autoAdvanceMs?`)
- `QuizHeader` (`onExit`, `confirmExit?`, `answered?`, `total?`, `lives?`, `maxLives?`, `remainingMs?`, `timeLimitMs?`, `streak?`, `title?`, `exitCopy?`) · `ExitConfirm` (`open`, `onStay`, `onLeave`, `description?`, `stayLabel?` = "Seguir jugando") · `LivesIndicator`, `TimeChip`, `StreakChip`, `isStreakMilestone(n)`
- `useQuizKeys(onKey(e) => boolean | void, enabled = true)` (ignora campos de texto y modales abiertos) · `optionIndexFromKey(key): number | null` · `isActivationTarget(target)`: el foco está en un botón/enlace/radio que ya reacciona a Enter/Espacio (los atajos de Enter/Espacio deben ignorarlo).

### PWA (`@/components/pwa`)
- `ServiceWorkerRegister` (ya en `layout.tsx`): registra `/sw.js?v=<NEXT_PUBLIC_BUILD_VERSION>` solo en producción (en desarrollo elimina SW/cachés previos); tras una actualización recarga en el siguiente cambio de ruta.
- `InstallPrompt` (`variant?: 'card'|'compact'`, `dismissible?` (true en card), `fallback?: ReactNode`, `className?`): muestra `fallback` (por defecto nada) en SSR, si ya está instalada (card), si se descartó o si no se puede instalar.
- `useInstallPrompt(): { canPrompt; installed; dismissed; isStandalone; platform: 'ios'|'mac-safari'|'other'; promptInstall(): Promise<'accepted'|'dismissed'|'unavailable'>; dismiss() }` · `useIsStandalone()` · `isStandaloneDisplay()` · `useOnlineStatus(): boolean | null` · `AppIcon` (`size?`, `className?`).
- `public/sw.js`: navegaciones red primero (~3,5 s) → caché → `/` → `/offline`; `/_next/static` caché primero; RSC red primero; resto stale-while-revalidate. Precachea las rutas de la tabla de Rutas (actualizar `APP_ROUTES` si se añaden rutas).

## Convenciones

- Todo el texto de la interfaz en español neutro, tuteo, frases cortas.
- Componentes interactivos con `'use client'`. Leer progreso solo con `useProgress()`; mientras `ready === false` mostrar `Skeleton`. Una `page.tsx` puede ser componente de servidor que exporte `metadata` y renderice un componente cliente (ver `app/tabla`); `useSearchParams` requiere `<Suspense>`.
- Nada de `Math.random()` durante el render del servidor; generar preguntas en efectos/handlers o tras `ready`.
- Ningún botón sin acción. Accesibilidad: roles, `aria-label`, foco visible, teclado (1–4 / A–D para responder, Enter para continuar; comprobar `isModalOpen()` en atajos globales).
- Imports con alias `@/…`. Sin `any`. Archivos pequeños y con una responsabilidad.
- Comprobaciones: `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`, `npx next build`.
