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
- ✅ Edición por instrucciones (la IA propone operaciones, el código las valida/aplica), plantillas con marcadores — 4 pruebas más
- 🟡 UI: edición por chat y plantillas
- ⬜ Editor visual drag/edit manual, propuestas múltiples, dominios, despliegue Vercel/Netlify, analítica, imágenes
## Fase 3 Chat Agent (parcial)
- ✅ Recuperación de conocimiento (BM25, sin acentos), agente con garantías duras: sin conocimiento→humano sin llamar a IA; cifras (precios/horas) no presentes en el conocimiento→bloqueo y humano; opt-out; salida inválida→humano; horario por zona — 15 pruebas (IA SIMULADA)
- ✅ WhatsApp: verificación de firma HMAC, challenge, parseo, envío (fetch simulado)
- 🟡 Migración 0004, webhook (idempotente, opt-out, ledger), simulador UI — requiere Supabase + credenciales Meta; 🔑 no validado con Meta real
- ⬜ Bandeja/CRM UI, etapas editables, citas, recordatorios, seguimiento, multimedia/audio, credenciales WhatsApp por workspace (hoy: env globales = una sola cuenta), UI de config del agente/base de conocimiento
- Nota: existe `whatsapp-assistant/` (JS, multi-negocio) en el repo; se conserva intacto.
## Fases 4–12: ⬜ (pestañas vacías en /app/[module])
**Siguiente tarea exacta:** Chat Agent: UI de configuración + base de conocimiento + bandeja/CRM (usa tablas 0004); luego Fase 4 Personal Assistant.
