import type { ImgHTMLAttributes } from 'react';
import icon192 from '../../public/icons/icon-192.png?inline';

/** Sustituto mínimo de `next/image`: un <img> normal con los iconos incrustados. */

const INLINE: Record<string, string> = { '/icons/icon-192.png': icon192 };

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  unoptimized?: boolean;
  priority?: boolean;
}

export default function Image({ src, alt, ...props }: ImageProps) {
  const rest = { ...props };
  delete rest.unoptimized;
  delete rest.priority;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={INLINE[src] ?? src} alt={alt ?? ''} {...rest} />;
}
