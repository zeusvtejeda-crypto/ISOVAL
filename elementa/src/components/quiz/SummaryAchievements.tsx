import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';

/** Logros desbloqueados durante la sesión. */
export function SummaryAchievements({ ids }: { ids: readonly string[] }) {
  const achievements = ids.map((id) => ACHIEVEMENTS_BY_ID[id]).filter((a) => a !== undefined);
  if (achievements.length === 0) return null;
  return (
    <section aria-labelledby="summary-achievements" className="rounded-3xl border border-xp/35 bg-xp-soft p-4">
      <h2 id="summary-achievements" className="flex items-center gap-2 font-black text-xp">
        <span aria-hidden>🏆</span>
        {achievements.length === 1 ? '¡Logro desbloqueado!' : `¡${achievements.length} logros desbloqueados!`}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {achievements.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 animate-pop">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-xp-soft text-2xl ring-2 ring-xp/40">
              {a.emoji}
            </span>
            <span className="min-w-0">
              <span className="block font-black">{a.title}</span>
              <span className="block text-sm text-muted">{a.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
