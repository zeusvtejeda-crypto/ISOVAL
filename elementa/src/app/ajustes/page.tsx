import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/settings/SettingsScreen';

export const metadata: Metadata = {
  title: 'Ajustes',
  description: 'Tema claro u oscuro, meta diaria, sonido y vibración, instalar la app y exportar, importar o reiniciar tu progreso.',
};

export default function AjustesPage() {
  return <SettingsScreen />;
}
