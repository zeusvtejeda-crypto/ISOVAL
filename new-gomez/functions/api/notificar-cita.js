// Cloudflare Pages Function — envía un correo al dueño cuando se registra una cita.
// Requiere las variables de entorno (Settings → Environment variables del proyecto Pages):
//   RESEND_API_KEY  — API key de https://resend.com (plan gratis)
//   DEST_EMAIL      — correo del dueño que debe recibir el aviso
//   FROM_EMAIL      — opcional, remitente (por defecto "NEW GOMEZ <onboarding@resend.dev>")
// Sin RESEND_API_KEY/DEST_EMAIL configuradas responde ok:false sin intentar enviar nada,
// para que un despliegue (p. ej. en GitHub Pages, que ni siquiera tiene esta función) o un
// proyecto de otra barbería sin configurar no rompan nunca el flujo de reserva del cliente.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY || !env.DEST_EMAIL) {
    return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  var body;
  try { body = await request.json(); }
  catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  var folio = String(body.folio || '').slice(0, 40);
  var nombre = String(body.nombre || 'Cliente').slice(0, 120);
  var telefono = String(body.telefono || '').slice(0, 30);
  var fecha = String(body.fecha || '').slice(0, 60);
  var hora = String(body.hora || '').slice(0, 20);
  var barbero = String(body.barbero || '').slice(0, 60);
  var servicios = Array.isArray(body.servicios) ? body.servicios.slice(0, 10).map(function (s) { return String(s).slice(0, 80) }) : [];
  var total = Number(body.total) || 0;
  var nota = String(body.nota || '').slice(0, 500);

  var html =
    '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;color:#15130F">' +
    '<h2 style="margin:0 0 10px">Nueva cita' + (folio ? ' · ' + esc(folio) : '') + '</h2>' +
    '<p style="margin:0 0 6px"><b>' + esc(nombre) + '</b>' + (telefono ? ' · ' + esc(telefono) : '') + '</p>' +
    '<p style="margin:0 0 6px">' + esc(fecha) + (hora ? ' a las ' + esc(hora) : '') + (barbero ? ' con ' + esc(barbero) : '') + '</p>' +
    '<p style="margin:0 0 6px">' + esc(servicios.join(' + ')) + ' — $' + total + ' MXN</p>' +
    (nota ? '<p style="margin:8px 0 0;color:#7A7366"><i>Nota: ' + esc(nota) + '</i></p>' : '') +
    '</div>';

  try {
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'NEW GOMEZ <onboarding@resend.dev>',
        to: [env.DEST_EMAIL],
        subject: 'Nueva cita: ' + nombre + (fecha ? ' — ' + fecha : '') + (hora ? ' ' + hora : ''),
        html: html
      })
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'send_failed', status: r.status }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'exception' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet() {
  return new Response('Method not allowed', { status: 405 });
}
