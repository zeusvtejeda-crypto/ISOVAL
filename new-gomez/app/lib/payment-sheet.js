// Pendiente (agente de caja). Contrato:
//   openPaymentSheet({ appointment?, client?, onDone? }) → Promise<payment|null>
//   Cobra una cita (monto = saldo, propina, método) o una venta suelta; emite bus 'payments:changed' y 'appointments:changed'.
import { toast } from './ui.js';
export async function openPaymentSheet(opts) { toast.info('Cobro en construcción'); return null; }
