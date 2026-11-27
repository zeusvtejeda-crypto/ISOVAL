# IMPLEMENTATION_STATUS
Leyenda: ✅ probado localmente · 🟡 implementado, no probado contra servicio real · 🔑 pendiente de credenciales · ⬜ no iniciado · 🚀 validado en producción (nada aún)

## Fase 1 Infra
- ✅ Registro de módulos, planes/límites, enrutador de eventos (pruebas unitarias)
- ✅ Gateway de IA (Anthropic/OpenAI/Gemini) con límite de créditos — probado con fetch SIMULADO; 🔑 sin llamadas reales
- ✅ Registro de integraciones + estado de variables
- 🟡 Auth (login/registro/reset/callback), proxy de sesión, onboarding→`create_workspace` RPC, contexto y bloqueo de módulos no contratados — requiere Supabase real (no hay docker/credenciales aquí)
- 🟡 Migraciones 0001/0002 (RLS) — no ejecutadas contra Postgres
- ⬜ Roles UI, perfiles, almacenamiento de archivos, credenciales por workspace cifradas, registro de errores, historial UI, i18n, tema claro/oscuro, activación de módulos (trial)
## Fases 2–12: ⬜ (pestañas vacías en /app/[module])
