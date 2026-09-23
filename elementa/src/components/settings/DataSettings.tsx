'use client';

import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CircleCheck, Download, RotateCcw, Upload } from 'lucide-react';
import { Button, Modal, TONE_SOFT, cn, type Tone } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { parseProgressJson } from '@/services/storage';
import { todayKey } from '@/utils/dates';
import { formatNumber } from '@/utils/format';
import { levelFromXp } from '@/utils/levels';
import { countLearned } from '@/utils/mastery';
import { downloadTextFile } from './download';
import { StatusMessage, type Status } from './StatusMessage';

/** Un progreso exportado pesa unos KB; cualquier cosa enorme no es un archivo de Elementa. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface PendingImport {
  json: string;
  name: string;
  level: number;
  xp: number;
  learned: number;
}

interface DataRowProps {
  icon: ReactNode;
  tone: Tone;
  title: string;
  description: string;
  action: (describedBy: string) => ReactNode;
}

function DataRow({ icon, tone, title, description, action }: DataRowProps) {
  const descId = useId();
  return (
    <li className="flex items-center gap-3 py-3.5">
      <span
        aria-hidden
        className={cn('hidden size-10 shrink-0 place-items-center rounded-2xl min-[380px]:grid [&_svg]:size-5', TONE_SOFT[tone])}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="leading-tight font-extrabold">{title}</p>
        <p id={descId} className="mt-0.5 text-sm leading-snug text-muted">
          {description}
        </p>
      </div>
      <div className="shrink-0">{action(descId)}</div>
    </li>
  );
}

function SummaryPill({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface-2 px-2 py-3 text-center">
      <span aria-hidden className="text-xl leading-none">
        {emoji}
      </span>
      <span className="mt-1 text-lg leading-tight font-black tabular">{value}</span>
      <span className="text-xs font-bold text-muted">{label}</span>
    </div>
  );
}

/** Exportar (descarga JSON), importar (con confirmación) y reiniciar el progreso. */
export function DataSettings() {
  const router = useRouter();
  const { exportData, importData, resetProgress } = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelImportRef = useRef<HTMLButtonElement>(null);
  const cancelResetRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [reading, setReading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  // Lo que muestra el diálogo de importar (se conserva mientras se cierra con animación).
  const [shownImport, setShownImport] = useState<PendingImport | null>(null);
  if (pending && pending !== shownImport) setShownImport(pending);

  const exportProgress = () => {
    try {
      downloadTextFile(`elementa-progreso-${todayKey()}.json`, exportData());
      setStatus({ tone: 'success', text: 'Descargamos tu progreso. Guarda el archivo para restaurarlo cuando quieras.' });
    } catch {
      setStatus({ tone: 'danger', text: 'No pudimos descargar el archivo. Inténtalo de nuevo.' });
    }
  };

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // Permite volver a elegir el mismo archivo.
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus({ tone: 'danger', text: 'Ese archivo es demasiado grande para ser un progreso de Elementa.' });
      return;
    }
    setReading(true);
    try {
      const json = await file.text();
      const parsed = parseProgressJson(json);
      if (!parsed) {
        setStatus({ tone: 'danger', text: 'Ese archivo no es un progreso válido de Elementa. Elige uno exportado desde aquí.' });
        return;
      }
      setStatus(null);
      setPending({
        json,
        name: parsed.profile.name.trim(),
        level: levelFromXp(parsed.xp).level,
        xp: parsed.xp,
        learned: countLearned(parsed),
      });
    } catch {
      setStatus({ tone: 'danger', text: 'No pudimos leer el archivo. Inténtalo de nuevo.' });
    } finally {
      setReading(false);
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    const ok = importData(pending.json);
    setPending(null);
    setStatus(
      ok
        ? { tone: 'success', text: `¡Progreso importado! Nivel ${pending.level} · ${formatNumber(pending.xp)} XP.` }
        : { tone: 'danger', text: 'No pudimos importar ese progreso. Tu progreso actual no cambió.' },
    );
  };

  const confirmResetProgress = () => {
    resetProgress();
    setConfirmReset(false);
    router.push('/bienvenida');
  };

  return (
    <>
      <ul className="-my-3.5 divide-y divide-border">
        <DataRow
          icon={<Download />}
          tone="brand"
          title="Exportar progreso"
          description="Descarga una copia (.json) de todo tu avance."
          action={(describedBy) => (
            <Button variant="secondary" size="sm" aria-describedby={describedBy} onClick={exportProgress}>
              Exportar
            </Button>
          )}
        />
        <DataRow
          icon={<Upload />}
          tone="accent"
          title="Importar progreso"
          description="Restaura una copia que exportaste antes."
          action={(describedBy) => (
            <Button
              variant="secondary"
              size="sm"
              aria-describedby={describedBy}
              loading={reading}
              onClick={() => fileRef.current?.click()}
            >
              Importar
            </Button>
          )}
        />
        <DataRow
          icon={<RotateCcw />}
          tone="danger"
          title="Reiniciar progreso"
          description="Empieza de cero. Tus ajustes se conservan."
          action={(describedBy) => (
            <Button
              variant="danger"
              size="sm"
              aria-describedby={describedBy}
              onClick={() => {
                setBackupDone(false);
                setConfirmReset(true);
              }}
            >
              Reiniciar
            </Button>
          )}
        />
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={onFileChosen}
      />
      <StatusMessage status={status} />
      <p className="mt-4 text-xs font-semibold text-muted">
        <span aria-hidden>🔒 </span>Tu progreso se guarda solo en este dispositivo: exporta una copia para llevarlo a otro.
      </p>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        size="sm"
        title="¿Importar este progreso?"
        description="Reemplazará el progreso que tienes ahora en este dispositivo."
        initialFocusRef={cancelImportRef}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button block className="sm:flex-1" leftIcon={<Upload aria-hidden />} onClick={confirmImport}>
              Importar progreso
            </Button>
            <Button ref={cancelImportRef} variant="ghost" block className="sm:flex-1" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </div>
        }
      >
        {shownImport && (
          <div>
            {shownImport.name && (
              <p className="mb-3 font-bold">
                Progreso de <span className="font-black">{shownImport.name}</span>
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <SummaryPill emoji="🏅" value={String(shownImport.level)} label="Nivel" />
              <SummaryPill emoji="⚡" value={formatNumber(shownImport.xp)} label="XP" />
              <SummaryPill emoji="⚛️" value={String(shownImport.learned)} label="Aprendidos" />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="¿Reiniciar tu progreso?"
        description="Se borrarán tu XP, nivel, racha, logros y el dominio de cada elemento. No se puede deshacer."
        initialFocusRef={cancelResetRef}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button variant="danger" block className="sm:flex-1" onClick={confirmResetProgress}>
              Sí, reiniciar todo
            </Button>
            <Button ref={cancelResetRef} variant="ghost" block className="sm:flex-1" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3.5 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm font-semibold">
            <span aria-hidden>💡 </span>¿Quieres guardar una copia antes? Podrás importarla después.
          </p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={backupDone ? <CircleCheck aria-hidden className="text-success" /> : <Download aria-hidden />}
            onClick={() => {
              exportProgress();
              setBackupDone(true);
            }}
          >
            {backupDone ? 'Copia descargada' : 'Exportar copia'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
