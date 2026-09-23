import { ProgressRing, StatTile, type Tone } from '@/components/ui';
import { formatDuration, formatNumber, formatPercent } from '@/utils/format';

interface SummaryScoreProps {
  correct: number;
  total: number;
  xpGained: number;
  durationMs: number;
}

function ringTone(ratio: number): Tone {
  if (ratio >= 0.8) return 'success';
  if (ratio >= 0.5) return 'brand';
  return 'warning';
}

/** Marcador grande ("17 / 20", "85%") y métricas de la sesión. */
export function SummaryScore({ correct, total, xpGained, durationMs }: SummaryScoreProps) {
  const ratio = total > 0 ? correct / total : 0;
  const pct = formatPercent(ratio);
  return (
    <>
      <div className="flex items-center justify-center gap-5 rounded-3xl border border-border bg-surface p-5 shadow-card sm:gap-8">
        <ProgressRing value={ratio} size={112} stroke={12} tone={ringTone(ratio)} label={`Porcentaje de aciertos: ${pct}`}>
          <span className="text-2xl font-black tabular">{pct}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-5xl leading-none font-black tabular animate-bounce-in">
            {correct}
            <span className="text-3xl text-muted"> / {total}</span>
          </p>
          <p className="mt-1.5 font-bold text-muted">{correct === 1 ? 'respuesta correcta' : 'respuestas correctas'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="✅" tone="success" label="Correctas" value={formatNumber(correct)} />
        <StatTile icon="❌" tone="danger" label="Incorrectas" value={formatNumber(Math.max(0, total - correct))} />
        <StatTile icon="⚡" tone="xp" label="XP ganada" value={`+${formatNumber(xpGained)} XP`} />
        <StatTile icon="⏱" tone="brand" label="Tiempo" value={formatDuration(durationMs)} />
      </div>
    </>
  );
}
