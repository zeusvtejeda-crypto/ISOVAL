# CLAUDE.md — VILLEDA AI Systems
Reglas permanentes (orden del dueño): trabajo autónomo; decide lo técnico sin preguntar; no detenerse tras una fase; misma rama (`claude/villeda-ai-systems-architecture-myufr4`); commits organizados; un módulo terminado = backend + persistencia + IA + validaciones + pruebas + docs + seguridad (no basta UI).
Honestidad: no inventar integraciones/credenciales/métricas; datos simulados siempre rotulados; separar *implementado / probado localmente / pendiente de credenciales / validado en producción*.
Sin credenciales: adaptador + pantalla de config + env vars + validación + pruebas simuladas + doc, y seguir.
No gastar dinero, enviar comunicaciones reales ni publicar sin autorización. Acciones sensibles → aprobación humana.
Stack: Next.js 16 (lee `node_modules/next/dist/docs/`; `middleware`→`proxy.ts`), TS, Tailwind 4, Supabase (RLS), Vitest, zod.
Calidad tras cada cambio: `npx tsc --noEmit && npm run lint && npm test && npm run build`.
Continuidad: leer MASTER_PLAN.md e IMPLEMENTATION_STATUS.md; actualizar al avanzar.
