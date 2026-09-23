/** Campo de texto de una línea (≥ 16 px para que iOS no haga zoom; 48 px de alto). */
export const TEXT_INPUT =
  'h-12 w-full min-w-0 rounded-2xl border-2 border-border bg-surface px-4 text-base font-bold text-fg ' +
  'transition-colors placeholder:font-semibold placeholder:text-muted hover:border-border-strong focus-visible:border-brand';

/** Máximo de caracteres del nombre del perfil. */
export const NAME_MAX_LENGTH = 24;

/** Nombre limpio para guardar: sin espacios sobrantes y con la longitud máxima. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
}
