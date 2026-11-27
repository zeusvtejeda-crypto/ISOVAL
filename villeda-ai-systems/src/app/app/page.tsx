import Link from "next/link";
import { MODULES } from "@/core/modules";

export default function Dashboard() {
  return (
    <>
      <h1 className="text-2xl font-bold">Panel</h1>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(MODULES).map((m) => (
          <li key={m.id}><Link href={`/app/${m.id}`} className="block rounded-lg border border-current/20 p-4 hover:bg-current/5">
            <div className="font-medium">{m.name}</div><div className="text-sm opacity-70">{m.tagline.es}</div>
          </Link></li>
        ))}
      </ul>
    </>
  );
}
