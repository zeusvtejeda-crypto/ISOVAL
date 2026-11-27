import { INTEGRATIONS, status } from "@/core/integrations";

export default function Settings() {
  const st = new Map(status().map((s) => [s.id, s]));
  return (
    <>
      <h1 className="text-2xl font-bold">Integraciones</h1>
      <p className="text-sm opacity-70">Solo se verifica que existan las variables; no se prueba la conexión real.</p>
      <ul className="mt-4 divide-y divide-current/15 rounded border border-current/20">
        {INTEGRATIONS.map((i) => { const s = st.get(i.id)!; return (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><b>{i.name}</b> <a className="underline opacity-60" href={i.docs} target="_blank" rel="noreferrer">docs</a></span>
            <span className={s.configured ? "text-green-600" : "opacity-70"}>{s.configured ? "Variables presentes" : `Faltan: ${s.missing.join(", ")}`}</span>
          </li>); })}
      </ul>
    </>
  );
}
