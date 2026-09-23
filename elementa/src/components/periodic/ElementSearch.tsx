'use client';

import { useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { cn, IconButton } from '@/components/ui';
import type { ChemicalElement } from '@/types';
import { categoryLabel } from '@/utils/format';
import { searchElements } from '@/utils/search';
import { ElementTile } from './ElementTile';

export interface ElementSearchProps {
  /** Elemento elegido (clic, toque o Enter). */
  onSelect: (atomicNumber: number) => void;
  autoFocus?: boolean;
  /** Números atómicos que coinciden con lo escrito (p. ej. para resaltarlos en la tabla). */
  onResultsChange?: (atomicNumbers: number[]) => void;
  placeholder?: string;
  /** Máximo de resultados. Por defecto 8. */
  limit?: number;
  className?: string;
}

/**
 * Buscador instantáneo por símbolo ("Au"), número ("79") o nombre ("Oro", sin acentos).
 * Combobox accesible: ↑/↓ para moverse, Enter para abrir, Escape para borrar.
 */
export function ElementSearch({
  onSelect,
  autoFocus = false,
  onResultsChange,
  placeholder = 'Busca: Au, 79 u Oro',
  limit = 8,
  className,
}: ElementSearchProps) {
  const id = useId();
  const listId = `${id}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchElements(query, limit), [query, limit]);
  const hasQuery = query.trim().length > 0;
  const expanded = open && hasQuery;
  const activeIndex = results.length > 0 ? Math.min(active, results.length - 1) : -1;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const update = (value: string) => {
    setQuery(value);
    setActive(0);
    setOpen(true);
    onResultsChange?.(searchElements(value, limit).map((el) => el.atomicNumber));
  };

  const choose = (el: ChemicalElement) => {
    update('');
    setOpen(false);
    onSelect(el.atomicNumber);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (results.length === 0) return;
        event.preventDefault();
        setOpen(true);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((activeIndex + step + results.length) % results.length);
        return;
      }
      case 'Enter': {
        const el = results[activeIndex];
        if (!el) return;
        event.preventDefault();
        choose(el);
        return;
      }
      case 'Escape':
        if (!hasQuery) return;
        event.preventDefault();
        event.stopPropagation();
        update('');
        return;
    }
  };

  const status = !hasQuery
    ? ''
    : results.length === 0
      ? 'Sin resultados'
      : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}. Usa las flechas para elegir.`;

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        Buscar un elemento por símbolo, número o nombre
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={query}
        onChange={(e: ChangeEvent<HTMLInputElement>) => update(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn(
          'h-13 w-full rounded-2xl border-2 border-border bg-surface pr-12 pl-12 text-base font-bold text-fg shadow-card',
          'placeholder:font-semibold placeholder:text-muted transition-[border-color,box-shadow] duration-150',
          'focus:border-brand focus:shadow-glow focus-visible:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {hasQuery && (
        <span className="absolute top-1/2 right-2 flex -translate-y-1/2">
          <IconButton
            label="Borrar búsqueda"
            icon={<X />}
            size="sm"
            onClick={() => {
              update('');
              inputRef.current?.focus();
            }}
          />
        </span>
      )}

      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      <ul
        id={listId}
        role="listbox"
        aria-label="Resultados"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(24rem,60dvh)] overflow-y-auto scroll-contained rounded-2xl border border-border bg-surface p-1.5 shadow-float animate-fade-in"
      >
        {results.map((el, i) => (
          <li
            key={el.atomicNumber}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => i !== activeIndex && setActive(i)}
            onClick={() => choose(el)}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2',
              i === activeIndex ? 'bg-brand-soft' : 'hover:bg-surface-2',
            )}
          >
            <ElementTile element={el} size="xs" decorative />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{el.name}</span>
              <span className="block truncate text-sm font-semibold text-muted">
                N.º {el.atomicNumber} · {el.symbol} · {categoryLabel(el.category)}
              </span>
            </span>
          </li>
        ))}
        {hasQuery && results.length === 0 && (
          <li role="presentation" className="px-3 py-4 text-center text-sm font-semibold text-muted">
            No encontramos «{query.trim()}». Prueba con un símbolo (Au), un número (79) o un nombre (Oro).
          </li>
        )}
      </ul>
    </div>
  );
}
