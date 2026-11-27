# VILLEDA AI Systems — Fase 1 (núcleo)

**Hecho y verificado** (`npm test`: 10 pruebas, `tsc`, `next build` OK):
- `src/core/modules.ts` — registro de los 10 módulos (id, fase, estado).
- `src/core/plans.ts` — planes y límites (módulos, créditos IA, automatizaciones, marca blanca). Precios = sugeridos, no definitivos.
- `src/core/events.ts` — enrutador de eventos entre módulos: aísla por workspace, exige módulos contratados, marca `pending_approval`.
- `supabase/migrations/0001_core.sql` — workspaces, members/roles, suscripciones, consumo, enlaces entre módulos, automatizaciones, eventos, auditoría; RLS por workspace.
- Landing con catálogo y planes.

**Pendiente (no implementado):** auth Supabase (UI), onboarding, Stripe/Mercado Pago, panel admin, i18n es/en, modo claro/oscuro, enforcement de `module_links`, migración probada contra una instancia Supabase real (no hay credenciales en este entorno).

**Activar:** crear proyecto Supabase, aplicar migración, definir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
