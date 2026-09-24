# Elementa

**¿Cuánto de la tabla periódica puedes dominar?** Elementa es una app web progresiva (PWA), en español,
para aprender y memorizar los 118 elementos jugando. Combina trivia estilo Preguntados, rachas y XP al
estilo Duolingo y flashcards con repetición espaciada al estilo Quizlet, con una identidad propia.

No hace falta registrarse: todo el progreso se guarda en el navegador y la app funciona sin conexión
después de la primera visita.

## Funciones

| Área | Qué hace | Ruta |
|---|---|---|
| Inicio | Nivel, XP, racha 🔥, elementos aprendidos (x / 118), precisión general, dominados, meta diaria, sesión de hoy («Continuar aprendiendo») y accesos rápidos | `/` |
| Primer uso | «¿Qué tanto conoces la tabla periódica?» (4 niveles de experiencia), meta diaria y diagnóstico de 10 preguntas que fija el nivel inicial | `/bienvenida` |
| Estudiar ahora | Sesión inteligente: elementos nuevos + repasos + difíciles, con duración estimada y resumen final («Sesión completada 🎉», XP, racha, «Hoy mejoraste…») | `/estudiar` |
| Tabla periódica | Los 118 elementos coloreados por sus 10 familias; ficha con Z, masa, grupo, periodo, familia, estado, configuración electrónica, descripción, dato curioso, truco de memoria y dominio. Buscador por símbolo, número o nombre («Au», «79», «Oro») | `/tabla` |
| Flashcards | 7 modos (símbolo→nombre, nombre→símbolo, número→elemento, elemento→número, familia, grupo, masa); ❌ No lo sabía · 😐 Casi · ✅ Lo sabía · ⚡ Muy fácil con repetición espaciada | `/flashcards` |
| Modo Preguntados | Ruleta de 6 categorías, 4 opciones, «✅ ¡Correcto! +10 XP» o «❌ Incorrecto» con la respuesta y una explicación breve | `/preguntados` |
| Preguntas visuales | Tocar la casilla correcta, seleccionar una familia completa, encontrar por número atómico | `/visual` |
| Mini exámenes | Rápido (10), normal (20), completo (50) y personalizado por temas; resultado, repaso de errores y «Practicar mis errores» | `/examen` |
| Contrarreloj | 60 segundos, récord personal | `/contrarreloj` |
| Supervivencia | 3 vidas ❤️❤️❤️, racha, puntos y récord | `/supervivencia` |
| Modo racha | Multiplicador de XP (x1.5, x2, x3) y bonus en x5, x10 y x20 | `/racha` |
| Aprende 5 | 5 elementos nuevos uno por uno y preguntas rápidas de comprobación | `/aprende` |
| Bloques y familias | Aprender por bloques de 10 (1–10, 11–20…) o por familia | `/bloques` |
| Mis errores | Elementos más difíciles con su % de dominio, historial de preguntas falladas y práctica dirigida | `/errores`, `/practicar` |
| Estadísticas | Dominados, precisión, preguntas, racha, tiempo estudiado, gráficas semanales, mejores familias y «Lo que debes practicar» | `/estadisticas` |
| Logros | 24 logros (Primer elemento, En llamas, Medio camino, Memoria atómica, Maestro de la tabla, Velocidad química…) | `/logros` |
| Ajustes | Tema claro/oscuro/sistema, meta diaria (5, 10, 20 o 50 preguntas), sonido, vibración y exportar/importar/reiniciar el progreso | `/ajustes` |

Gamificación: +10 XP por acierto, +15 en preguntas difíciles, +50 por terminar un examen y +100 extra si
es perfecto. Niveles con título (Aprendiz, Explorador, Químico Junior, Químico, Experto, Maestro de los
Elementos…). Racha diaria con calendario semanal L M M J V S D.

Aprendizaje: cada elemento tiene un dominio de 0 a 100 % (🔴 Necesita práctica · 🟠 Aprendiendo · 🟡 Casi
dominado · 🟢 Dominado) calculado con aciertos, fallos, respuestas recientes, tiempo de respuesta y tiempo
desde el último acierto. El algoritmo prioriza, en este orden, los elementos fallados, los que llevan días
sin practicarse, los nuevos y los que se responden despacio, con una repetición espaciada tipo SM-2
simplificada.

## Requisitos

- Node.js 20.9 o superior (lo exige Next.js 16).
- npm (el repositorio incluye `package-lock.json`).

## Comandos

```bash
npm install          # instala las dependencias
npm run dev          # desarrollo en http://localhost:3000 (sin service worker)
npm run build        # compilación de producción
npm start            # sirve la compilación (por defecto en el puerto 3000)
npm test             # pruebas unitarias (Vitest)
npm run lint         # ESLint
npm run typecheck    # TypeScript sin emitir (tsc --noEmit)
npm run build:standalone  # versión de un solo archivo (ver abajo)
npm run icons        # regenera favicon, apple-icon e iconos PWA desde scripts/icon-art.mjs
```

Antes de publicar un cambio deben pasar `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`.

## Estructura

```
src/
  app/                 Rutas (App Router). Cada page.tsx solo compone componentes.
  components/
    ui/                Primitivas de diseño (Button, Card, Modal, ProgressBar…) y cn()
    layout/            AppShell, navegación inferior y lateral, TopBar, tema
    gamification/      Nivel, racha, meta diaria, logros, confeti y celebraciones
    periodic/          Tabla periódica, casillas, ficha del elemento, buscador
    quiz/              Motor visual de preguntas (QuizScreen, feedback, resumen)
    <pantalla>/        dashboard, onboarding, learn, flashcards, games, exam, practice,
                       visual, mistakes, stats, achievements, settings, hub, pwa
  data/                Datos estáticos: los 118 elementos, familias, niveles, logros, bloques
  types/               Contratos compartidos (elemento, progreso, preguntas)
  utils/               Lógica pura sin React: motor de aprendizaje, dominio, SRS, XP,
                       generador de preguntas, selección y plan de estudio
  hooks/               Hooks de React (useProgress, useQuizSession, useTheme…)
  store/               Estado global del progreso (store externo + Provider)
  services/storage/    Persistencia intercambiable (ProgressRepository)
public/                sw.js (service worker) e iconos
scripts/               Generación de iconos
```

La referencia completa de módulos, APIs y convenciones está en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Cómo se guarda el progreso

Todo el progreso (perfil, ajustes, XP, progreso por elemento, errores, actividad diaria, récords y
logros) es un único objeto `ProgressState` que se guarda en `localStorage` bajo la clave
`elementa:progress:v1`, validado y migrado por versión al cargarlo. Se guarda automáticamente (con
un pequeño retraso) tras cada respuesta y al ocultar la pestaña; si guardar falla, se reintenta y se
muestra un aviso. Si lo guardado está dañado, se conserva una copia de seguridad
(`elementa:progress:corrupt:<fecha>`) antes de empezar de cero. Dos pestañas abiertas se sincronizan
entre sí. Desde Ajustes se puede exportar e importar el progreso como JSON.

### Conectar Supabase o Firebase

El progreso nunca se lee ni se escribe directamente en `localStorage`: el store habla con un `ProgressRepository`
(`src/services/storage/types.ts`):

```ts
interface ProgressRepository {
  load(): Promise<LoadResult>;   // 'ok' | 'empty' | 'corrupt' | 'error'
  save(state: ProgressState): Promise<void>;   // debe lanzar si no pudo guardar (el store reintenta)
  clear(): Promise<void>;
  watch?(onChange: (state: ProgressState | null) => void): () => void;   // cambios externos
}
```

Para usar un backend:

1. Crea una clase, p. ej. `SupabaseRepository`, que implemente esa interfaz (guardar el `ProgressState`
   como JSON en una fila por usuario es suficiente). Valida lo que leas con `parseProgressState` de
   `src/services/storage`.
2. Asígnala en `src/services/storage/index.ts` (`export const progressRepository = …`). Es el único
   punto que hay que cambiar: el store, los hooks y las pantallas no dependen del almacenamiento.
3. Opcional: implementa `watch` con las suscripciones en tiempo real del servicio para sincronizar
   dispositivos.

Para seguir funcionando sin conexión, el repositorio puede combinar ambos: leer y escribir en
`LocalStorageRepository` y sincronizar con el servidor en segundo plano.

## Versión de un solo archivo

`npm run build:standalone` genera `dist-standalone/elementa.html`: la app completa en un único HTML
(~1 MB) que se abre con doble clic, sin servidor ni instalación. Usa las mismas páginas, estado y
estilos, compilados con Vite (`standalone/`), con un enrutador por hash (`#/tabla?e=8`) en lugar del de
Next.js (`standalone/shims/`). El progreso se guarda en el `localStorage` de ese archivo. No incluye el
service worker. También genera `elementa.fragment.html`, el mismo contenido sin `<html>/<head>/<body>`,
para hosts que ponen su propio esqueleto (como los artefactos de claude.ai).

## PWA y modo sin conexión

- Instalable en iPhone, Android y escritorio: manifiesto en `src/app/manifest.ts` (`display: standalone`,
  iconos normales y *maskable*, accesos directos) e iconos generados con `npm run icons`.
- `public/sw.js` se registra solo en producción (`npm run build && npm start`); en desarrollo se
  desinstala para no servir versiones viejas. Precachea todas las pantallas; las navegaciones van a la
  red primero y, sin conexión, a la copia guardada o a la página `/offline`. Cada compilación instala
  un service worker nuevo y borra las cachés anteriores (versión en `NEXT_PUBLIC_BUILD_VERSION`).
- Como el progreso y las preguntas se generan en el navegador, tras la primera visita se puede estudiar
  y jugar sin conexión.
- Tema claro/oscuro guardado en el dispositivo y aplicado antes del primer pintado (sin parpadeo).

## Datos y verificación

Los datos de los 118 elementos están en `src/data/elements.ts`:

- **Masas atómicas**: pesos atómicos estándar abreviados de la IUPAC/CIAAW (*Atomic Weights 2021*,
  revisión 2024), con los ceros finales de la tabla (H 1.0080). Para elementos sin isótopos estables se
  muestra entre corchetes el número másico del isótopo más estable.
- **Configuraciones electrónicas**: NIST Atomic Spectra Database (estado fundamental); para Z ≥ 104 son
  predicciones teóricas.
- **Familia, estado a 25 °C y electronegatividad (Pauling)**: PubChem Periodic Table (NIH). El estado
  del astato y del francio se marca como predicho (nunca se han visto en cantidad visible) y el de
  Z ≥ 100 como desconocido.
- **Textos** (descripción, dato curioso, truco de memoria, origen del símbolo): redactados en español
  a partir de esas fuentes.

Cómo se verificó:

- Los valores numéricos se contrastaron elemento por elemento con las tablas de la CIAAW y PubChem. Una
  prueba automática (`src/utils/__tests__/questions.test.ts`) compara la masa que muestra la app con la
  tabla abreviada de la CIAAW para los 84 elementos con peso estándar.
- Las pruebas del generador recorren todos los tipos de pregunta con los 118 elementos y comprueban
  que haya 4 opciones únicas con una sola correcta y que no se pregunte nada ambiguo (clasificaciones
  discutidas, estados predichos, el bloque de La, Lu, Ac y Lr…).
- Las pruebas del motor (`src/utils/__tests__`) cubren dominio, repetición espaciada, XP, rachas,
  logros, plan de estudio y persistencia (incluida la invariante «un fallo nunca sube el dominio»).

## Tecnología

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS v4 · lucide-react · Vitest.
