// Lanzador de la demo: elegir con qué rol entrar. Todo corre en el navegador con datos ficticios.
import { html, raw, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { toast } from '../lib/ui.js';

const ROLES = [
  { k: 'owner', t: 'Dueño', d: 'Dashboard con ingresos y barbero más activo, agenda de todo el equipo, caja, comisiones, reportes y configuración.', ic: 'crown', cred: 'dueno@demo.mx' },
  { k: 'barber', t: 'Barbero', d: 'Su día con las citas en orden, sus clientes, su horario y lo que lleva ganado.', ic: 'scissors', cred: 'barbero@demo.mx' },
  { k: 'client', t: 'Cliente', d: 'Cómo ve el cliente sus citas: reservar, reagendar o cancelar.', ic: 'user', cred: 'cliente@demo.mx' },
  { k: 'superadmin', t: 'Superadmin', d: 'La plataforma completa: varias barberías aisladas, altas y suspensiones.', ic: 'shield', cred: 'admin@demo.mx' }
];

export default {
  title: 'Demo',
  async render(el) {
    el.innerHTML = String(html`
      <div class="auth" style="grid-template-columns:minmax(0,1fr)">
        <section class="auth-panel" style="max-width:640px">
          <a href="#/login" class="link-btn" style="margin-bottom:8px">${raw(icon('arrow-left', 'ic-sm'))}Volver</a>
          <div class="row"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span><span class="badge brand plain" style="margin-left:4px">DEMO</span></div>
          <h1>Explora la demo</h1>
          <p class="lead">"La Navaja Barber Club" es una barbería ficticia con 4 barberos, 140 clientes y 3 meses de historial. Elige cómo quieres entrar; puedes cambiar de rol cuando quieras desde la barra superior.</p>
          <div class="stack stagger" id="roles">
            ${ROLES.map((r) => html`
              <button type="button" class="card interactive card-pad" data-role="${r.k}" style="text-align:left;display:flex;gap:14px;align-items:flex-start;width:100%">
                <span class="avatar lg" style="--c:var(--ink);color:var(--brand)">${raw(icon(r.ic))}</span>
                <span class="grow"><b style="font-size:16px">${r.t}</b><span class="muted" style="display:block;font-size:13.5px;margin-top:2px">${r.d}</span>
                <span class="faint mono" style="display:block;font-size:12px;margin-top:6px">${r.cred} · demo1234</span></span>
                ${raw(icon('chevron-right'))}
              </button>`)}
          </div>
          <div class="banner info" style="margin-top:18px">${raw(icon('info'))}<div class="grow">Los datos viven solo en este navegador: puedes crear, cobrar y cancelar sin miedo. Nada llega a clientes reales y los mensajes de WhatsApp se abren como borrador.</div></div>
          <p class="muted" style="font-size:13.5px;margin-top:16px;text-align:center"><a class="link-btn" href="#/guia">${raw(icon('book', 'ic-sm'))}Ver la guía para presentar la demo en una barbería</a></p>
        </section>
      </div>`);
    return on(el, 'click', '[data-role]', async (e, b) => {
      if (b.getAttribute('aria-busy') === 'true') return;
      b.setAttribute('aria-busy', 'true');
      b.style.opacity = '.7';
      try {
        await window.TB.demoLogin(b.dataset.role);
        toast.success('Bienvenido a la demo');
      } catch (err) {
        console.error(err);
        toast.error(err);
        b.removeAttribute('aria-busy'); b.style.opacity = '';
      }
    });
  }
};
