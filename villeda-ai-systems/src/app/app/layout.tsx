import Link from "next/link";
import { MODULES } from "@/core/modules";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const mods = Object.values(MODULES).sort((a, b) => a.phase - b.phase);
  return (
    <div className="min-h-screen">
      <nav aria-label="Módulos" className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-current/20 bg-[var(--background)] px-3 py-2">
        <Link href="/app" className="shrink-0 rounded px-3 py-1.5 text-sm font-semibold hover:bg-current/10">Inicio</Link>
        {mods.map((m) => (
          <Link key={m.id} href={`/app/${m.id}`} className="shrink-0 rounded px-3 py-1.5 text-sm hover:bg-current/10">{m.name}</Link>
        ))}
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
