import { ELEMENTS, ELEMENTS_BY_NUMBER, ELEMENTS_BY_SYMBOL } from '@/data/elements';
import type { ChemicalElement, Question } from '@/types';
import { elementDifficulty } from '../difficulty';
import { normalizeText, pluralize } from '../format';
import { randomInt, shuffle } from '../random';
import {
  buildMultipleChoice,
  elementOption,
  fallbackElements,
  nearbyElements,
  nearbyValues,
  ofElement,
  rankCandidates,
  toElement,
  windowElements,
  windowValues,
  withArticleCap,
  type OptionSpec,
} from './helpers';

/** Explicación del símbolo: usa la etimología si existe. */
export function symbolExplanation(el: ChemicalElement): string {
  const base = `${el.symbol} es el símbolo ${ofElement(el)}`;
  const etymology = el.etymology.trim();
  return etymology ? `${base}. ${etymology}` : `${base} (número atómico ${el.atomicNumber}).`;
}

/**
 * Símbolos construidos con letras del nombre (primera letra + otra letra), p. ej. Sodio → So, Sd, Si, S.
 * Devuelve por separado los inventados (no existen) y los reales (son de otro elemento).
 */
export function symbolsFromName(el: ChemicalElement): { invented: string[]; real: string[] } {
  const invented: string[] = [];
  const real: string[] = [];
  const seen = new Set<string>([el.symbol]);
  for (const name of [el.name, ...el.altNames]) {
    const letters = normalizeText(name).replace(/[^a-z]/g, '');
    if (!letters) continue;
    const first = letters[0].toUpperCase();
    const candidates = [first, ...letters.slice(1).split('').map((c) => first + c)];
    for (const s of candidates) {
      if (seen.has(s) || s.toLowerCase() === first.toLowerCase() + first.toLowerCase()) continue;
      seen.add(s);
      (ELEMENTS_BY_SYMBOL[s] ? real : invented).push(s);
    }
  }
  return { invented, real };
}

function symbolOption(symbol: string): OptionSpec {
  const el = ELEMENTS_BY_SYMBOL[symbol];
  return el ? { label: symbol, atomicNumber: el.atomicNumber } : { label: symbol };
}

export function nameToSymbol(el: ChemicalElement): Question | null {
  const { invented, real } = symbolsFromName(el);
  const inventedCount = randomInt(1, 2);
  // Los inventados más creíbles usan las primeras letras del nombre.
  const inventedPick = shuffle(invented.slice(0, 4)).slice(0, inventedCount);
  const neighbors = shuffle(
    [...nearbyElements(el.atomicNumber, 3), ...ELEMENTS.filter((e) => e.symbol[0] === el.symbol[0])]
      .filter((e) => e.atomicNumber !== el.atomicNumber)
      .map((e) => e.symbol),
  );
  const candidates = [
    ...inventedPick,
    ...shuffle(real).slice(0, 1),
    ...neighbors,
    ...invented,
    ...fallbackElements(el).map((e) => e.symbol),
  ].map(symbolOption);

  return buildMultipleChoice({
    type: 'name-to-symbol',
    el,
    prompt: `¿Cuál es el símbolo ${ofElement(el)}?`,
    subject: el.name,
    correct: { label: el.symbol, atomicNumber: el.atomicNumber },
    candidates,
    explanation: symbolExplanation(el),
    difficulty: elementDifficulty(el),
  });
}

function symbolSimilarity(target: ChemicalElement, other: ChemicalElement): number {
  if (other.atomicNumber === target.atomicNumber) return 0;
  const sym = target.symbol.toLowerCase();
  const otherName = normalizeText(other.name);
  let s = 0;
  if (other.symbol[0] === target.symbol[0]) s += 2;
  if (otherName.startsWith(sym)) s += 3;
  else if (otherName[0] === sym[0]) s += 1.5;
  if (sym.length > 1 && other.symbol.toLowerCase().includes(sym[1])) s += 0.5;
  if (Math.abs(other.atomicNumber - target.atomicNumber) <= 2) s += 1;
  return s;
}

export function symbolToName(el: ChemicalElement): Question | null {
  const similar = rankCandidates(ELEMENTS, (o) => symbolSimilarity(el, o), 7);
  return buildMultipleChoice({
    type: 'symbol-to-name',
    el,
    prompt: `¿Qué elemento tiene el símbolo ${el.symbol}?`,
    subject: el.symbol,
    correct: elementOption(el, false),
    candidates: [...similar, ...fallbackElements(el)].map((e) => elementOption(e, false)),
    explanation: symbolExplanation(el),
    difficulty: elementDifficulty(el),
  });
}

export function numberToElement(el: ChemicalElement): Question | null {
  const z = el.atomicNumber;
  return buildMultipleChoice({
    type: 'number-to-element',
    el,
    prompt: `¿Qué elemento tiene el número atómico ${z}?`,
    subject: String(z),
    correct: elementOption(el),
    candidates: [...windowElements(z), ...nearbyElements(z, 4), ...fallbackElements(el)].map((e) =>
      elementOption(e),
    ),
    explanation: `El número atómico ${z} corresponde ${toElement(el)} (${el.symbol}): tiene ${z} ${pluralize(z, 'protón', 'protones')} en su núcleo.`,
    difficulty: elementDifficulty(el),
  });
}

export function elementToNumber(el: ChemicalElement): Question | null {
  const z = el.atomicNumber;
  const prev = ELEMENTS_BY_NUMBER[z - 1];
  const next = ELEMENTS_BY_NUMBER[z + 1];
  const between =
    prev && next ? ` Está entre ${prev.name} (${prev.atomicNumber}) y ${next.name} (${next.atomicNumber}).` : '';
  return buildMultipleChoice({
    type: 'element-to-number',
    el,
    prompt: `¿Cuál es el número atómico ${ofElement(el)}?`,
    subject: el.symbol,
    correct: { label: String(z) },
    candidates: [...windowValues(z, 1, ELEMENTS.length), ...nearbyValues(z, 1, ELEMENTS.length, 6)].map((n) => ({
      label: String(n),
    })),
    explanation: `${withArticleCap(el)} (${el.symbol}) tiene número atómico ${z}: ${z} ${pluralize(z, 'protón', 'protones')} en el núcleo.${between}`,
    difficulty: elementDifficulty(el),
  });
}
