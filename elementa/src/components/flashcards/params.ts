import { sanitizeElements } from './deck';
import { isFlashcardModeId, type FlashcardModeId } from './modes';

export interface FlashcardParams {
  /** `?elements=1,2,3`: mazo personalizado (`null` si no hay ninguno válido). */
  elements: number[] | null;
  /** `?mode=<id>`. */
  mode: FlashcardModeId | null;
}

interface ParamSource {
  get(name: string): string | null;
}

/** Lee `?elements=` y `?mode=` ignorando valores inválidos. */
export function parseFlashcardParams(params: ParamSource): FlashcardParams {
  const rawElements = params.get('elements');
  const elements = rawElements
    ? sanitizeElements(
        rawElements
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^\d{1,3}$/.test(s))
          .map(Number),
      )
    : [];
  const rawMode = params.get('mode');
  return {
    elements: elements.length > 0 ? elements : null,
    mode: isFlashcardModeId(rawMode) ? rawMode : null,
  };
}
