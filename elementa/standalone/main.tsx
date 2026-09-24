/**
 * Entrada de la versión de un solo archivo (`npm run build:standalone`).
 *
 * Monta la misma app que Next.js (mismas páginas, estado y estilos) sobre un enrutador por hash, para
 * abrirla sin servidor: como archivo local o publicada como página estática. No incluye el service
 * worker (la página entera ya va en un solo archivo).
 */
import { StrictMode, Suspense, useSyncExternalStore, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import '@/app/globals.css';
import { CelebrationHost } from '@/components/gamification/CelebrationHost';
import { AppShell } from '@/components/layout/AppShell';
import { ChromeProvider } from '@/components/layout/ChromeContext';
import { ProgressProvider } from '@/store/ProgressProvider';
import HomePage from '@/app/page';
import NotFound from '@/app/not-found';
import AjustesPage from '@/app/ajustes/page';
import AprendePage from '@/app/aprende/page';
import BienvenidaPage from '@/app/bienvenida/page';
import BloquesPage from '@/app/bloques/page';
import ContrarrelojPage from '@/app/contrarreloj/page';
import ErroresPage from '@/app/errores/page';
import EstadisticasPage from '@/app/estadisticas/page';
import EstudiarPage from '@/app/estudiar/page';
import ExamenPage from '@/app/examen/page';
import FlashcardsPage from '@/app/flashcards/page';
import JugarPage from '@/app/jugar/page';
import LogrosPage from '@/app/logros/page';
import PracticarPage from '@/app/practicar/page';
import PreguntadosPage from '@/app/preguntados/page';
import RachaPage from '@/app/racha/page';
import SupervivenciaPage from '@/app/supervivencia/page';
import TablaPage from '@/app/tabla/page';
import VisualPage from '@/app/visual/page';
import { getLocation, startRouter, subscribe } from './router';

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/ajustes': AjustesPage,
  '/aprende': AprendePage,
  '/bienvenida': BienvenidaPage,
  '/bloques': BloquesPage,
  '/contrarreloj': ContrarrelojPage,
  '/errores': ErroresPage,
  '/estadisticas': EstadisticasPage,
  '/estudiar': EstudiarPage,
  '/examen': ExamenPage,
  '/flashcards': FlashcardsPage,
  '/jugar': JugarPage,
  '/logros': LogrosPage,
  '/practicar': PracticarPage,
  '/preguntados': PreguntadosPage,
  '/racha': RachaPage,
  '/supervivencia': SupervivenciaPage,
  '/tabla': TablaPage,
  '/visual': VisualPage,
};

function CurrentPage() {
  const { pathname } = useSyncExternalStore(subscribe, getLocation, getLocation);
  const Page = ROUTES[pathname] ?? NotFound;
  // `key`: cada ruta monta su página desde cero, como una navegación de Next.
  return (
    <Suspense fallback={null}>
      <Page key={pathname} />
    </Suspense>
  );
}

function App() {
  return (
    <ProgressProvider>
      <ChromeProvider>
        <AppShell>
          <CurrentPage />
        </AppShell>
        <CelebrationHost />
      </ChromeProvider>
    </ProgressProvider>
  );
}

startRouter(Object.keys(ROUTES));
document.documentElement.lang = 'es';
document.body.classList.add('bg-bg', 'font-sans', 'text-fg', 'antialiased');

const container = document.getElementById('elementa-root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
