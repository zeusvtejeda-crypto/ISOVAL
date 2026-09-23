import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STUDY_BLOCKS, FAMILY_GROUPS } from '@/data/blocks';
import { getElement } from '@/data/elements';
import type { SessionSummaryData } from '@/types';
import { createInitialState } from '@/utils/engine';
import { masteryMap } from '@/utils/mastery';
import { planStudySession } from '@/utils/planner';
import { BlockCard } from '../BlockCard';
import { FamilyCard } from '../FamilyCard';
import { groupProgress, suggestNextBlock } from '../group-progress';
import { LearnAllDone } from '../LearnAllDone';
import { LearnCard } from '../LearnCard';
import { LearnComplete } from '../LearnComplete';
import { LearnIntro } from '../LearnIntro';
import { NextBlockCard } from '../NextBlockCard';
import { resolveLearnSource } from '../learn-source';
import { StudyPlanView } from '../StudyPlanView';
import { StudySummary } from '../StudySummary';

const NOW = new Date(2026, 0, 15, 12);
const state = createInitialState(NOW);
const mastery = masteryMap(state, NOW);
const summary: SessionSummaryData = {
  mode: 'study', title: 'x', total: 20, correct: 18, xpGained: 200, durationMs: 60000,
  improved: [8, 6, 19], toReview: [26], unlockedAchievements: ['first-element'],
};

describe('pantallas de aprendizaje (render estático)', () => {
  it('se renderizan con el contenido esperado', () => {
    const out: string[] = [];
    out.push(renderToStaticMarkup(h(LearnCard, { element: getElement(26) })));
    out.push(renderToStaticMarkup(h(LearnCard, { element: getElement(58), variant: 'quick' })));
    out.push(renderToStaticMarkup(h(StudyPlanView, { plan: planStudySession(state, NOW), onStart: () => {} })));
    out.push(renderToStaticMarkup(h(StudySummary, { summary, learned: [1, 2], learnXp: 10, onAnother: () => {} })));
    const src = resolveLearnSource(new URLSearchParams('block=b3'));
    out.push(renderToStaticMarkup(h(LearnIntro, { source: src, elements: [21, 22, 23], learnedInPool: 7, onStart: () => {} })));
    out.push(renderToStaticMarkup(h(LearnComplete, { summary, elements: [21, 22, 23, 24, 25], learnXp: 25, remaining: 3, onMore: () => {} })));
    out.push(renderToStaticMarkup(h(LearnAllDone, { source: resolveLearnSource(new URLSearchParams('family=noble-gas')) })));
    out.push(renderToStaticMarkup(h(LearnAllDone, { source: src })));
    const bp = groupProgress(STUDY_BLOCKS[0].atomicNumbers, state, mastery);
    out.push(renderToStaticMarkup(h(BlockCard, { block: STUDY_BLOCKS[0], progress: bp, state, mastery })));
    out.push(renderToStaticMarkup(h(FamilyCard, { family: FAMILY_GROUPS[2], progress: groupProgress(FAMILY_GROUPS[2].atomicNumbers, state, mastery), state, mastery })));
    const progress = Object.fromEntries(STUDY_BLOCKS.map((b) => [b.id, groupProgress(b.atomicNumbers, state, mastery)]));
    const sug = suggestNextBlock(STUDY_BLOCKS, progress)!;
    out.push(renderToStaticMarkup(h(NextBlockCard, { suggestion: sug, progress: progress[sug.block.id], state, mastery })));
    const text = out.map((o) => o.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    for (const t of text) expect(t.length).toBeGreaterThan(20);
    const [fe, ce, plan, study, intro, complete, nobleDone, blockDone, block, family, next] = text;
    expect(fe).toContain('¿Por qué Fe?');
    expect(fe).toContain('Dato curioso');
    expect(fe).toContain('Ubicación en la tabla');
    expect(ce).toContain('Bloque f · Periodo 6');
    expect(ce).not.toContain('Dato curioso');
    expect(plan).toContain('5 elementos nuevos');
    expect(plan).toContain('Comenzar sesión');
    expect(study).toContain('Sesión completada');
    expect(study).toContain('+210 XP');
    expect(study).toContain('Hoy mejoraste');
    expect(study).toContain('Practicar mis errores');
    expect(study).toContain('Otra sesión');
    expect(intro).toContain('Aprende 3 elementos nuevos hoy');
    expect(complete).toContain('Aprendiste 5 elementos nuevos');
    expect(complete).toContain('Aprender 3 más');
    expect(nobleDone).toContain('¡Ya aprendiste los gases nobles!');
    expect(blockDone).toContain('¡Ya aprendiste todo el Bloque 3!');
    expect(block).toContain('Bloque 1 · Elementos 1–10');
    expect(block).toContain('Nuevo');
    expect(family).toContain('+20');
    expect(next).toContain('Empezar bloque');
  });
});
