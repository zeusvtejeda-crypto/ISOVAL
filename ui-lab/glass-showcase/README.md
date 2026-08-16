# Glass Showcase

Componente de sección en **glassmorphism** con React + Tailwind + Framer Motion:
fondo mesh gradient animado, tarjetas de cristal con resplandor que sigue al
cursor, insignias flotantes en loop y entradas escalonadas.

Es autocontenido: no toca ni depende de las páginas estáticas de este repo.

---

## 1. Dependencias

```bash
npm i framer-motion
npm i -D tailwindcss @tailwindcss/vite
```

Versiones con las que está probado: **React 19**, **Tailwind 4.3**, **Framer Motion 13**, **Vite 8**.

### Vite

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### CSS

`index.css` ya trae el `@import "tailwindcss"`, los tokens del tema y dos
utilidades que el componente necesita (`.ring-mask` y `.grain`). Impórtalo una
sola vez en el punto de entrada:

```jsx
// main.jsx
import "./index.css";
```

> **Si sigues en Tailwind v3:** no hay plugin de Vite ni bloque `@theme`.
> Sustituye el `@import` por las tres directivas (`@tailwind base;` etc.), mueve
> los colores de `@theme` a `theme.extend.colors` en `tailwind.config.js`
> (quitando el prefijo `--color-`), y conserva tal cual el resto de `index.css`.

---

## 2. Uso

```jsx
import GlassShowcase from "./components/GlassShowcase";

export default function App() {
  return <GlassShowcase />;
}
```

Las piezas también sirven sueltas:

```jsx
<SpotlightCard glow="56, 224, 208" className="p-8">
  <h3>Cualquier contenido</h3>
</SpotlightCard>
```

---

## 3. Estructura

| Archivo | Qué hace |
| --- | --- |
| `lib/motion.js` | Curvas, muelles y variantes compartidas. Es la fuente de la coherencia: si cada componente inventara sus duraciones, el conjunto se notaría descoordinado. |
| `components/MeshBackground.jsx` | Fondo oscuro con manchas de color desenfocadas que derivan, retícula tenue y viñeta. |
| `components/SpotlightCard.jsx` | La tarjeta de cristal. Resplandor ligado al cursor, elevación y escala en hover. |
| `components/FloatingBadge.jsx` | Insignia con flotación infinita y resplandor que late. |
| `components/CountUp.jsx` | Contador que arranca al entrar en pantalla. |
| `components/GlassShowcase.jsx` | La sección montada — úsala como referencia o como punto de partida. |
| `index.css` | Tokens del tema y las utilidades `.ring-mask` / `.grain`. |

### Props de `SpotlightCard`

| Prop | Tipo | Por defecto | |
| --- | --- | --- | --- |
| `glow` | `string` | `"124, 92, 255"` | Color del resplandor en **RGB sin envolver** (`"R, G, B"`), porque se compone con alfa variable dentro del degradado. |
| `lift` | `number` | `-8` | Píxeles que sube en hover. |
| `className` | `string` | `""` | Se concatena; aquí va el padding. |

---

## 4. Las tres decisiones que sostienen la fluidez

**El cursor no pasa por el estado de React.** La posición vive en `useMotionValue`
y Framer Motion escribe directo en el DOM. Mover el ratón sobre una tarjeta no
provoca ni un render — es la diferencia entre 60 fps y un componente que se
atraganta.

**El borde luminoso es una máscara, no un `box-shadow`.** `.ring-mask` compone
dos máscaras con XOR para recortar el degradado a 1 px de contorno. Un
`box-shadow` animado repinta; una máscara sobre un elemento ya compuesto, no.

**Solo se anima lo barato.** `transform` y `opacity` en todos los bucles. El
`blur` de las manchas del fondo es grande y fijo: animarlo obligaría al
navegador a recalcular el filtro en cada fotograma, que es justo por lo que
estos fondos suelen ir a tirones.

---

## 5. Accesibilidad

- `prefers-reduced-motion` está respetado en los cinco componentes vía
  `useReducedMotion()`: se eliminan los bucles infinitos, el seguimiento del
  cursor y los desplazamientos; los elementos aparecen con un fundido corto.
- Las capas decorativas llevan `aria-hidden`.
- `:focus-visible` está definido con contraste suficiente sobre el fondo oscuro.

Dos cosas que **debes** revisar contra tu contenido real:

- El texto con degradado (`bg-clip-text`) no tiene un contraste único medible.
  Funciona en un titular grande; no lo lleves a texto de párrafo.
- `text-mist-dim` (`#9ea0b8`) sobre el fondo base da ~7:1, pero el mesh gradient
  aclara zonas del fondo. Si mueves las manchas de sitio, vuelve a medir.
