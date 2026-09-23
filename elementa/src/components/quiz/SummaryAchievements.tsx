import Link from 'next/link';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';

/** Logros que se muestran enteros; el resto se resume con un enlace a «Logros». */
const MAX_SHOWN = 3;

/** Logros desbloqueados durante la sesión (compactos: caben varios sin alargar el resumen). */
export function SummaryAchievements({ ids }: { ids: readonly string[] }) {
  const achievements = ids.map((id) => ACHIEVEMENTS_BY_ID[id]).filter((a) => a !== undefined);
  if (achievements.length === 0) return null;
  const shown = achievements.slice(0, MAX_SHOWN);
  const hidden = achievements.length - shown.length;
  return (
    <section aria-labelledby="summary-achievements" className="rounded-3xl border border-xp/35 bg-xp-soft p-3.5">
      <h2 id="summary-achievements" className="flex items-center gap-2 font-black text-xp">
        <span aria-hidden>🏆</span>
        {achievements.length === 1 ? '¡Logro desbloqueado!' : `¡${achievements.length} logros desbloqueados!`}
      </h2>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {shown.map((a) => (
          <li key={a.id} className="flex items-center gap-2.5 rounded-2xl bg-surface p-2.5 animate-pop">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-xp-soft text-xl ring-2 ring-xp/40">
              {a.emoji}
            </span>
            <span className="min-w-0">
              <span className="block leading-tight font-black">{a.title}</span>
              <span className="block text-xs leading-snug text-muted">{a.description}</span>
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Link href="/logros" className="mt-2 inline-flex min-h-11 items-center text-sm font-black text-xp hover:underline">
          Y {hidden} más: ver todos tus logros
        </Link>
      )}
    </section>
  );
}
