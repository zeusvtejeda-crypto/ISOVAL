// Notificaciones push (Web Push) para avisar al Almacén de lo que hace Rubén.
// Firma VAPID (ES256, RFC 8292) y cifra el mensaje con aes128gcm (RFC 8291), todo con WebCrypto.
// Las llaves VAPID y las suscripciones viven en la tabla config (claves "vapid" y "push"); solo el servidor las lee.

const enc = new TextEncoder();
const b64u = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const unir = (...partes) => { const n = partes.reduce((t, p) => t + p.length, 0); const out = new Uint8Array(n); let i = 0; partes.forEach((p) => { out.set(p, i); i += p.length; }); return out; };

async function hkdf(salt, ikm, info, largo) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, largo * 8));
}

// Cifra el texto para una suscripción (RFC 8291, un solo registro).
export async function cifrar(texto, p256dh, auth) {
  const uaPub = deB64u(p256dh), secreto = deB64u(auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(secreto, compartido, unir(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const llave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, llave, unir(enc.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // tamaño de registro 4096
  return unir(salt, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

// Llaves VAPID: se crean una sola vez y se guardan en config.
export async function llavesVapid(raw) {
  if (raw && raw.vapid && raw.vapid.publica && raw.vapid.privada) return { nuevas: false, ...raw.vapid };
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publica = b64u(await crypto.subtle.exportKey('raw', par.publicKey));
  const privada = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { nuevas: true, publica, privada };
}

async function jwtVapid(endpoint, vapid, ahora) {
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(ahora / 1000) + 12 * 3600, sub: 'mailto:avisos@basesbox.mx' })));
  const k = await crypto.subtle.importKey('jwk', vapid.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(cab + '.' + cuerpo));
  return cab + '.' + cuerpo + '.' + b64u(firma);
}

// Manda el aviso a todas las suscripciones guardadas; devuelve las que el servicio dio por muertas (404/410).
export async function enviar(raw, aviso, opts) {
  opts = opts || {};
  const subs = Array.isArray(raw && raw.push) ? raw.push : [];
  if (!subs.length || !(raw.vapid && raw.vapid.privada)) return { enviados: 0, muertas: [] };
  const ahora = opts.ahora || Date.now(), hacer = opts.fetch || fetch;
  const texto = JSON.stringify({ titulo: aviso.titulo, texto: aviso.texto, url: aviso.url || '/' });
  const muertas = []; let enviados = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const body = await cifrar(texto, s.p256dh, s.auth);
      const r = await hacer(s.endpoint, {
        method: 'POST', body,
        headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: 'vapid t=' + await jwtVapid(s.endpoint, raw.vapid, ahora) + ', k=' + raw.vapid.publica }
      });
      if (r.status === 404 || r.status === 410) muertas.push(s.endpoint); else if (r.ok) enviados++;
    } catch (e) { /* un servicio caído no detiene a los demás */ }
  }));
  return { enviados, muertas };
}

export const _pruebas = { b64u, deB64u, hkdf, unir };
