import type { Metadata } from 'next';
import { TableExplorer } from './_components/TableExplorer';

export const metadata: Metadata = {
  title: 'Tabla periódica',
  description:
    'Explora los 118 elementos: busca por símbolo, número o nombre, filtra por familias y abre la ficha de cada elemento con datos, curiosidades y trucos para recordarlo.',
};

export default function TablaPage() {
  return <TableExplorer />;
}
