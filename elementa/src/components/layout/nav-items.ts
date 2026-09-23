import {
  ChartColumn,
  ClipboardCheck,
  Gamepad2,
  House,
  Layers,
  LayoutGrid,
  Settings,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Otras rutas que pertenecen a esta sección (la marcan como activa). */
  match?: readonly string[];
}

/** Destinos principales: barra inferior (móvil) y barra lateral (escritorio). */
export const MAIN_NAV: readonly NavItem[] = [
  { href: '/', label: 'Inicio', icon: House, match: ['/estudiar', '/aprende', '/bloques'] },
  { href: '/tabla', label: 'Tabla', icon: LayoutGrid },
  {
    href: '/jugar',
    label: 'Jugar',
    icon: Gamepad2,
    match: ['/preguntados', '/examen', '/contrarreloj', '/supervivencia', '/racha', '/visual', '/practicar', '/flashcards'],
  },
  { href: '/estadisticas', label: 'Progreso', icon: ChartColumn, match: ['/logros', '/errores'] },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
];

/** Accesos rápidos de la barra lateral. */
export const QUICK_NAV: readonly NavItem[] = [
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/examen', label: 'Examen', icon: ClipboardCheck },
  { href: '/errores', label: 'Mis errores', icon: Target },
  { href: '/logros', label: 'Logros', icon: Trophy },
];

function matches(pathname: string, route: string): boolean {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** 'page' si la ruta es exactamente este destino, 'section' si pertenece a su sección, o `null`. */
export function navState(item: NavItem, pathname: string): 'page' | 'section' | null {
  if (matches(pathname, item.href)) return 'page';
  if (item.match?.some((route) => matches(pathname, route))) return 'section';
  return null;
}
