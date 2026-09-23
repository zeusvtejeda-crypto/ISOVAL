import type { ExperienceLevel } from '@/types';

export interface ExperienceOption {
  value: ExperienceLevel;
  emoji: string;
  title: string;
  hint: string;
}

/** Punto de partida que elige el usuario en la bienvenida (escala la dificultad del diagnóstico). */
export const EXPERIENCE_OPTIONS: readonly ExperienceOption[] = [
  { value: 'beginner', emoji: '🌱', title: 'Estoy empezando', hint: 'Partimos de lo más básico.' },
  { value: 'some', emoji: '📚', title: 'Conozco algunos elementos', hint: 'Me sé los más famosos.' },
  { value: 'chemistry', emoji: '🧪', title: 'Tengo conocimientos de química', hint: 'Grupos, periodos y familias.' },
  { value: 'master', emoji: '⚛️', title: 'Quiero dominarla completa', hint: 'Los 118, con todo detalle.' },
];

export function experienceOption(value: ExperienceLevel | null | undefined): ExperienceOption | null {
  return EXPERIENCE_OPTIONS.find((o) => o.value === value) ?? null;
}
