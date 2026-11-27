import type { Section, SiteSpec } from "./spec";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const FONTS = { system: "system-ui,sans-serif", serif: "Georgia,serif", mono: "ui-monospace,monospace" };

function section(s: Section, i: number): string {
  switch (s.type) {
    case "hero": return `<header class="hero">${s.image ? `<img src="${esc(s.image.src)}" alt="${esc(s.image.alt)}" loading="eager">` : ""}<h1>${esc(s.title)}</h1>${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ""}${s.cta ? `<a class="btn" href="${esc(s.cta.href)}">${esc(s.cta.label)}</a>` : ""}</header>`;
    case "features": return `<section aria-labelledby="s${i}"><h2 id="s${i}">${esc(s.title)}</h2><ul class="grid">${s.items.map((f) => `<li><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join("")}</ul></section>`;
    case "text": return `<section${s.title ? ` aria-labelledby="s${i}"` : ""}>${s.title ? `<h2 id="s${i}">${esc(s.title)}</h2>` : ""}<p>${esc(s.body)}</p></section>`;
    case "catalog": return `<section aria-labelledby="s${i}"><h2 id="s${i}">${esc(s.title)}</h2><ul class="grid">${s.items.map((c) => `<li><h3>${esc(c.name)}</h3>${c.description ? `<p>${esc(c.description)}</p>` : ""}${c.price ? `<strong>${esc(c.price)}</strong>` : ""}</li>`).join("")}</ul></section>`;
    case "contact": return `<section aria-labelledby="s${i}"><h2 id="s${i}">${esc(s.title)}</h2>${s.address ? `<p>${esc(s.address)}</p>` : ""}${s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ""}${s.phone ? `<p><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></p>` : ""}${s.whatsapp ? `<p><a class="btn" href="https://wa.me/${s.whatsapp}">WhatsApp</a></p>` : ""}${s.mapUrl ? `<p><a href="${esc(s.mapUrl)}">Mapa</a></p>` : ""}${s.form && s.email ? `<form action="mailto:${esc(s.email)}" method="post" enctype="text/plain"><label>Nombre <input name="nombre" required></label><label>Mensaje <textarea name="mensaje" required></textarea></label><button class="btn">Enviar</button></form>` : ""}</section>`;
  }
}

/** Genera un sitio estático autocontenido (sin JS, responsive, semántico). */
export function renderSite(spec: SiteSpec): string {
  const t = spec.theme;
  return `<!doctype html><html lang="${spec.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.name)}</title><meta name="description" content="${esc(spec.description)}"><meta property="og:title" content="${esc(spec.name)}"><meta property="og:description" content="${esc(spec.description)}"><style>:root{--p:${t.primary};--bg:${t.background};--tx:${t.text}}*{box-sizing:border-box}body{margin:0;font-family:${FONTS[t.font]};background:var(--bg);color:var(--tx);line-height:1.6}main,.hero{max-width:60rem;margin:auto;padding:2rem 1rem}.hero img{max-width:100%;height:auto}.grid{list-style:none;padding:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}.grid li{border:1px solid color-mix(in srgb,var(--tx) 20%,transparent);border-radius:.5rem;padding:1rem}.btn{display:inline-block;background:var(--p);color:var(--bg);padding:.6rem 1.2rem;border-radius:.4rem;text-decoration:none;border:0;font:inherit;cursor:pointer}form{display:grid;gap:.75rem;max-width:28rem}input,textarea{width:100%;font:inherit;padding:.5rem}:focus-visible{outline:3px solid var(--p);outline-offset:2px}</style></head><body>${spec.sections.map(section).map((h, i) => (spec.sections[i].type === "hero" ? h : "")).join("")}<main>${spec.sections.map((s, i) => (s.type === "hero" ? "" : section(s, i))).join("")}</main></body></html>`;
}
