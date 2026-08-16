# Glass Showcase

Sección en **glassmorphism** con React + Tailwind + Framer Motion, en TypeScript:
fondo mesh gradient animado, tarjetas de cristal con resplandor que sigue al
cursor, insignias flotantes en loop, panel de scroll horizontal y modal
accesible.

Es autocontenido: no toca ni depende de las páginas estáticas de este repo.

---

## 1. Dependencias

```bash
npm i framer-motion
npm i -D tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom
```

Probado con **React 19**, **Tailwind 4.3**, **Framer Motion 13**, **Vite 8**, **TypeScript 5**.

### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### CSS

`index.css` trae el `@import "tailwindcss"`, los tokens del tema y dos utilidades
que los componentes necesitan (`.ring-mask` y `.grain`). Impórtalo una sola vez
en el punto de entrada:

```tsx
// main.tsx
import "./index.css";
```

### TypeScript

Necesitas los tipos de Vite para que el import del CSS no dé error:

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
```

El código está escrito para `strict: true` y pasa `tsc --noEmit` limpio.

> **Si sigues en Tailwind v3:** no hay plugin de Vite ni bloque `@theme`.
> Sustituye el `@import` por las tres directivas (`@tailwind base;` etc.), mueve
> los colores de `@theme` a `theme.extend.colors` en `tailwind.config.js`
> (quitando el prefijo `--color-`), y conserva tal cual el resto de `index.css`.

---

## 2. Uso

```tsx
import GlassShowcase from "./components/GlassShowcase";

export default function App() {
  return <GlassShowcase />;
}
```

Las piezas sirven sueltas:

```tsx
<SpotlightCard glow={GLOW.aqua} className="p-8">
  <h3>Cualquier contenido</h3>
</SpotlightCard>

<HorizontalScroller heading={<h2>Proceso</h2>}>
  {items.map((i) => (
    <SpotlightCard key={i.id} className="w-[80vw] shrink-0 snap-center p-8 sm:w-[22rem]">
      …
    </SpotlightCard>
  ))}
</HorizontalScroller>

<GlassModal open={open} onClose={() => setOpen(false)} title="Título">
  …
</GlassModal>
```

---

## 3. Estructura

| Archivo | Qué hace |
| --- | --- |
| `lib/motion.ts` | Curvas, muelles, variantes y la paleta `GLOW`. Es la fuente de la coherencia: si cada componente inventara sus duraciones, el conjunto se notaría descoordinado. |
| `lib/useMediaQuery.ts` | Suscripción a media queries, con el estado inicial en `false` para no romper la hidratación en SSR. |
| `components/MeshBackground.tsx` | Fondo fijo con manchas de color desenfocadas que derivan, retícula tenue y viñeta. |
| `components/SpotlightCard.tsx` | La tarjeta de cristal. Resplandor ligado al cursor, elevación y escala en hover. |
| `components/FloatingBadge.tsx` | Insignia con flotación infinita y resplandor que late. |
| `components/CountUp.tsx` | Contador que arranca al entrar en pantalla. |
| `components/HorizontalScroller.tsx` | Panel horizontal ligado al scroll vertical en escritorio; scroll nativo con snap en táctil. |
| `components/GlassModal.tsx` | Diálogo en portal con `AnimatePresence`, trampa de foco y bloqueo de scroll. |
| `components/GlassShowcase.tsx` | La sección montada — úsala como referencia o como punto de partida. |
| `index.css` | Tokens del tema y las utilidades `.ring-mask` / `.grain`. |

### Props principales

**`SpotlightCard`** — extiende `HTMLMotionProps<"div">`.

| Prop | Tipo | Por defecto | |
| --- | --- | --- | --- |
| `glow` | `GlowColor` | `GLOW.iris` | Color del resplandor en **RGB sin envolver** (`"R, G, B"`), porque se compone con alfa variable dentro del degradado. |
| `lift` | `number` | `-8` | Píxeles que sube en hover. |

**`HorizontalScroller`** — `children`, `heading?`, `className?`.

**`GlassModal`** — `open`, `onClose`, `title`, `description?`, `children?`, `footer?`.

---

## 4. Las decisiones que sostienen esto

**El cursor no pasa por el estado de React.** La posición vive en `useMotionValue`
y Framer Motion escribe directo en el DOM. Mover el ratón sobre una tarjeta no
provoca ni un render — es la diferencia entre 60 fps y un componente que se
atraganta. Mismo motivo en `CountUp`: escribe con `textContent` en vez de
guardar el número en estado.

**El borde luminoso es una máscara, no un `box-shadow`.** `.ring-mask` compone
dos máscaras con XOR para recortar el degradado a 1 px de contorno. Un
`box-shadow` animado repinta; una máscara sobre un elemento ya compuesto, no.

**Solo se anima lo barato.** `transform` y `opacity` en todos los bucles. El
`blur` de las manchas del fondo es grande y fijo: animarlo obligaría al
navegador a recalcular el filtro en cada fotograma, que es justo por lo que
estos fondos suelen ir a tirones.

**El scroll horizontal no secuestra el gesto.** No hay `preventDefault` en
ninguna parte: la sección simplemente es más alta que la pantalla y el progreso
del scroll normal se traduce a desplazamiento lateral. Rueda, trackpad, flechas
y barra de scroll siguen comportándose como el usuario espera.

### Dos trampas que ya están resueltas dentro

Merece la pena conocerlas si tocas `HorizontalScroller`:

1. **La rama la decide sólo el dispositivo, nunca la medición.** Si el recorrido
   medido entrara en la condición de qué se renderiza, se forma un bucle: medir
   cambia de rama y cambiar de rama vuelve a medir. La medición ajusta la altura
   de la sección, no la estructura.

2. **El nodo medido se guarda en estado con una ref de callback.** Al cambiar de
   rama React monta un elemento distinto; con un `useRef` normal el efecto no se
   entera y el `ResizeObserver` se queda observando el nodo viejo — y un elemento
   desconectado del DOM reporta ancho 0. El guardia `isConnected` cubre la
   carrera que queda entre el desmontaje y la baja del observer.

Y una tercera, de CSS: el margen final de la pista es un elemento flex real, no
`padding-right`. En un contenedor que desborda, los navegadores no cuentan el
padding derecho dentro de `scrollWidth`, así que la última tarjeta acababa
clavada contra el borde de la pantalla.

---

## 5. Accesibilidad

- `prefers-reduced-motion` respetado en todos los componentes vía
  `useReducedMotion()`: se eliminan los bucles infinitos, el seguimiento del
  cursor y los desplazamientos; los elementos aparecen con un fundido corto.
  El scroller cae a scroll nativo.
- El modal cumple lo que hace falta para ser un diálogo de verdad: `role`,
  `aria-modal`, `aria-labelledby`, foco que entra al abrir y **vuelve al
  disparador** al cerrar, `Tab` atrapado dentro, `Escape` y clic fuera para
  cerrar, y bloqueo de scroll compensando el ancho de la barra para que la
  página no dé un salto lateral.
- Las capas decorativas llevan `aria-hidden`.
- `:focus-visible` definido con contraste suficiente sobre el fondo oscuro.

Dos cosas que **debes** revisar contra tu contenido real:

- El texto con degradado (`bg-clip-text`) no tiene un contraste único medible.
  Funciona en un titular grande; no lo lleves a texto de párrafo.
- `text-mist-dim` (`#9ea0b8`) sobre el fondo base da ~7:1, pero el mesh gradient
  aclara zonas del fondo. Si mueves las manchas de sitio, vuelve a medir.

---

## 6. Verificación

Comprobado en Chromium sobre el build de producción:

- `tsc --noEmit` limpio en modo estricto; build sin avisos.
- Scroller en escritorio: la pista arranca en 0, avanza monotónicamente y llega
  al final exacto del recorrido; la última tarjeta queda completamente visible.
- Scroller en táctil: scroll nativo con desbordamiento real, sin inflar la
  altura de la sección.
- Modal: abre, atrapa el foco, `Escape` y clic fuera cierran, el foco vuelve al
  disparador y el scroll del fondo se restaura.
- Movimiento reducido: ningún elemento queda oculto.
- Sin desbordamiento horizontal a 1440, 1024, 768 y 390 px.
- Sin errores de consola en ninguno de los recorridos.
