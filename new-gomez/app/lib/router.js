// Enrutador por hash (#/ruta/:param?query) — funciona en cualquier hosting estático y como PWA.
const routes = [];
let onChange = null;

export function defineRoutes(list) {
  for (const r of list) {
    const keys = [];
    const re = new RegExp('^' + r.path.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push(Object.assign({}, r, { re, keys }));
  }
}

export function parseHash(hash) {
  const h = (hash || location.hash || '#/').replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function match(path) {
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
  }
  return null;
}

// navigate('/agenda', { query: { fecha: '2026-10-01' }, replace: true })
export function navigate(path, opts) {
  opts = opts || {};
  const q = opts.query ? Object.entries(opts.query).filter(([, v]) => v != null && v !== '') : [];
  const target = '#' + path + (q.length ? '?' + new URLSearchParams(q).toString() : '');
  if (location.hash === target) { if (opts.force && onChange) onChange(); return; }
  if (opts.replace) { history.replaceState(null, '', target); if (onChange) onChange(); }
  else location.hash = target;
}
// Cambia solo la query de la ruta actual sin re-render (p. ej. filtros en la URL).
export function setQuery(query) {
  const { path } = parseHash();
  const q = Object.entries(query || {}).filter(([, v]) => v != null && v !== '');
  history.replaceState(null, '', '#' + path + (q.length ? '?' + new URLSearchParams(q).toString() : ''));
}

export function startRouter(fn) {
  onChange = fn;
  window.addEventListener('hashchange', fn);
  fn();
}
