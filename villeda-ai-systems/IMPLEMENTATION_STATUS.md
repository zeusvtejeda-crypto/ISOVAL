# IMPLEMENTATION_STATUS
Leyenda: ✅ probado localmente · 🟡 implementado, no probado contra servicio real · 🔑 pendiente de credenciales · ⬜ no iniciado · 🚀 validado en producción (nada aún)

## Fase 1 Infra
- ✅ Registro de módulos, planes/límites, enrutador de eventos (pruebas unitarias)
- ✅ Gateway de IA (Anthropic/OpenAI/Gemini) con límite de créditos — probado con fetch SIMULADO; 🔑 sin llamadas reales
- ✅ Registro de integraciones + estado de variables
- 🟡 Auth (login/registro/reset/callback), proxy de sesión, onboarding→`create_workspace` RPC, contexto y bloqueo de módulos no contratados — requiere Supabase real (no hay docker/credenciales aquí)
- 🟡 Migraciones 0001/0002 (RLS) — no ejecutadas contra Postgres
- ⬜ Roles UI, perfiles, almacenamiento de archivos, credenciales por workspace cifradas, registro de errores, historial UI, i18n, tema claro/oscuro, activación de módulos (trial)
## Fase 2 Web Studio (parcial)
- ✅ Esquema de sitio (zod, bloquea `javascript:`), generador HTML estático escapado/semántico, auditoría SEO/contraste, versiones con restauración, generación IA con validación+reintento (IA SIMULADA en pruebas) — 13 pruebas
- 🟡 Migración 0003 (RLS exige módulo contratado), acciones (crear/restaurar), lista de proyectos, vista previa sandbox, auditoría, descarga HTML — requiere Supabase real
- ⬜ Editor visual, plantillas, propuestas múltiples, asistente conversacional de edición, dominios, despliegue Vercel/Netlify, analítica, imágenes
## Fases 3–12: ⬜ (pestañas vacías en /app/[module])
**Siguiente tarea exacta:** completar Web Studio (editor de secciones + chat de edición + plantillas), luego Fase 3 Chat Agent (reutilizar `whatsapp-assistant/` del repo como referencia).
