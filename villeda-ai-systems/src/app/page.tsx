import { MODULES } from "@/core/modules";
import { PLANS } from "@/core/plans";

export default function Home() {
  const mods = Object.values(MODULES).sort((a, b) => a.phase - b.phase);
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">VILLEDA AI Systems</h1>
      <p className="mt-2 text-lg opacity-80">Ecosistema modular de automatización con IA. Contrata solo lo que necesitas.</p>
      <h2 className="mt-12 text-2xl font-semibold">Módulos</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mods.map((m) => (
          <li key={m.id} className="rounded-lg border border-current/20 p-4">
            <div className="font-medium">{m.name}</div>
            <div className="text-sm opacity-70">{m.tagline.es}</div>
            <div className="mt-2 text-xs uppercase opacity-60">Fase {m.phase} · {m.status}</div>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-2xl font-semibold">Planes <span className="text-sm font-normal opacity-60">(precios iniciales sugeridos, MXN)</span></h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.values(PLANS).map((p) => (
          <li key={p.id} className="rounded-lg border border-current/20 p-4">
            <div className="font-medium">{p.name}</div>
            <div className="text-2xl">${p.priceMxnMonthly.toLocaleString("es-MX")}<span className="text-sm opacity-60"> /mes</span></div>
            <div className="mt-2 text-sm opacity-70">{Number.isFinite(p.maxModules) ? p.maxModules : "Todos"} módulo(s) · {p.maxSeats} usuario(s){p.whiteLabel ? " · marca blanca" : ""}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
