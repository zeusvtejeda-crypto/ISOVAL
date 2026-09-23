import type { MetadataRoute } from 'next';

/** Colores de marca del manifiesto (coinciden con `--color-bg` y `--color-brand` de globals.css). */
const BACKGROUND_COLOR = '#f6f5fb';
const THEME_COLOR = '#6841f0';

type ManifestIcon = NonNullable<MetadataRoute.Manifest['icons']>[number];

function shortcutIcon(id: string): ManifestIcon[] {
  return [{ src: `/icons/shortcut-${id}.png`, sizes: '96x96', type: 'image/png' }];
}

/** Manifiesto de la PWA: `/manifest.webmanifest` (los iconos se generan con `npm run icons`). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Elementa — Domina la tabla periódica',
    short_name: 'Elementa',
    description:
      'Memoriza los 118 elementos de la tabla periódica jugando: flashcards, trivia, exámenes, retos contrarreloj y repetición espaciada. Funciona sin conexión.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Sin bloqueo de orientación: en tabletas la app también se usa en horizontal.
    orientation: 'any',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ['education', 'games'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Estudiar ahora',
        short_name: 'Estudiar',
        description: 'Sesión inteligente con elementos nuevos, repasos y los que más te cuestan.',
        url: '/estudiar',
        icons: shortcutIcon('estudiar'),
      },
      {
        name: 'Tabla periódica',
        short_name: 'Tabla',
        description: 'Explora los 118 elementos y abre la ficha de cada uno.',
        url: '/tabla',
        icons: shortcutIcon('tabla'),
      },
      {
        name: 'Contrarreloj',
        short_name: 'Contrarreloj',
        description: '60 segundos para acertar todas las que puedas.',
        url: '/contrarreloj',
        icons: shortcutIcon('contrarreloj'),
      },
      {
        name: 'Flashcards',
        short_name: 'Flashcards',
        description: 'Repasa con tarjetas y repetición espaciada.',
        url: '/flashcards',
        icons: shortcutIcon('flashcards'),
      },
    ],
  };
}
