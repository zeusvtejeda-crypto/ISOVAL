import type { NextConfig } from 'next';

/**
 * Identificador de la compilación. El cliente registra el service worker como `/sw.js?v=<versión>`
 * (components/pwa/sw-client.ts): cada despliegue instala un SW nuevo que vuelve a precachear la app
 * y borra las cachés de la versión anterior. Se puede fijar con NEXT_PUBLIC_BUILD_VERSION.
 */
const BUILD_VERSION =
  process.env.NEXT_PUBLIC_BUILD_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36);

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const SERVICE_WORKER_HEADERS = [
  { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
  // El navegador debe ver siempre la última versión del SW.
  { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
  { key: 'Service-Worker-Allowed', value: '/' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/sw.js', headers: SERVICE_WORKER_HEADERS },
    ];
  },
};

export default nextConfig;
