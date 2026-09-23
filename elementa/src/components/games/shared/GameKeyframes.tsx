/**
 * Animaciones propias de los modos de juego (llama de la racha, corazón que se rompe, ruleta en reposo).
 * React 19 eleva y deduplica este <style> por su `href`, así que puede montarse en varios sitios.
 * Con `prefers-reduced-motion` la regla global de globals.css las reduce a su estado final.
 */
const KEYFRAMES = `
@keyframes eg-flicker {
  0%, 100% { transform: rotate(-3deg) scale(1, 1); }
  25% { transform: rotate(2deg) scale(1.05, 0.96); }
  50% { transform: rotate(-1deg) scale(0.97, 1.06); }
  75% { transform: rotate(3deg) scale(1.03, 0.98); }
}
@keyframes eg-glow {
  0%, 100% { transform: scale(0.9); filter: brightness(1); }
  50% { transform: scale(1.1); filter: brightness(1.15); }
}
@keyframes eg-heartbeat {
  0%, 60%, 100% { transform: scale(1); }
  15% { transform: scale(1.2); }
  30% { transform: scale(1); }
  45% { transform: scale(1.12); }
}
@keyframes eg-heart-left {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  22% { transform: translate(-1px, -3px) rotate(-6deg) scale(1.08); opacity: 1; }
  100% { transform: translate(-16px, 34px) rotate(-42deg); opacity: 0; }
}
@keyframes eg-heart-right {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  22% { transform: translate(1px, -3px) rotate(6deg) scale(1.08); opacity: 1; }
  100% { transform: translate(16px, 34px) rotate(42deg); opacity: 0; }
}
@keyframes eg-wheel-idle {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

export function GameKeyframes() {
  return (
    <style href="elementa-game-keyframes" precedence="default">
      {KEYFRAMES}
    </style>
  );
}
