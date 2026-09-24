// Hash de contraseñas/PIN y tokens con WebCrypto (disponible en Workers y navegadores).
import { randomString } from './util.js';

const enc = new TextEncoder();
const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));

export async function sha256Hex(s) { return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }

// Iteraciones moderadas: el plan gratuito de Workers limita CPU por petición. El número queda
// guardado en cada hash, así que subirlo después no invalida contraseñas existentes.
export const PBKDF2_ITERATIONS = 40000;

async function pbkdf2(secret, saltBytes, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256);
  return toHex(bits);
}
// Formato: pbkdf2$<iter>$<saltHex>$<hashHex>
export async function hashSecret(secret, iterations) {
  const it = iterations || PBKDF2_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return 'pbkdf2$' + it + '$' + toHex(salt) + '$' + (await pbkdf2(secret, salt, it));
}
export async function verifySecret(secret, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [alg, it, salt, hash] = stored.split('$');
  if (alg !== 'pbkdf2' || !it || !salt || !hash) return false;
  const got = await pbkdf2(String(secret), fromHex(salt), +it);
  // comparación en tiempo constante
  if (got.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
export function newToken() { return randomString(40, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'); }
