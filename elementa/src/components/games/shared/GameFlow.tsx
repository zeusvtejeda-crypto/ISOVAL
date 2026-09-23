'use client';

import { useCallback, useState, type ReactNode } from 'react';

export interface GameFlowProps {
  /** Presentación del modo; `play` empieza la partida. */
  renderIntro: (play: () => void) => ReactNode;
  /** Partida; `exit` vuelve a la presentación. */
  renderPlay: (exit: () => void) => ReactNode;
}

/** Alterna entre la presentación de un modo y la partida (que se monta de cero cada vez). */
export function GameFlow({ renderIntro, renderPlay }: GameFlowProps) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => setPlaying(true), []);
  const exit = useCallback(() => {
    setPlaying(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return <>{playing ? renderPlay(exit) : renderIntro(play)}</>;
}
