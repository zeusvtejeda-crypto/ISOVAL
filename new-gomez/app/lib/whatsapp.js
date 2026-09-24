// Pendiente (agente de mensajes). Contrato:
//   sendWhatsApp({ appointment_id?, client_id?, kind, body? }) → prepara el mensaje (POST /api/messages/prepare),
//   abre wa.me en una pestaña nueva, marca 'opened' y muestra toast. Devuelve el mensaje o null.
//   editAndSendWhatsApp({...}) → igual pero deja editar el texto antes de enviarlo.
import { toast } from './ui.js';
export async function sendWhatsApp(opts) { toast.info('WhatsApp en construcción'); return null; }
export async function editAndSendWhatsApp(opts) { return sendWhatsApp(opts); }
