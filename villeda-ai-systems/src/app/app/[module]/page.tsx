import { notFound } from "next/navigation";
import { MODULES, MODULE_IDS, isModuleId } from "@/core/modules";

export function generateStaticParams() { return MODULE_IDS.map((module) => ({ module })); }

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!isModuleId(module)) notFound();
  const m = MODULES[module];
  return (
    <>
      <h1 className="text-2xl font-bold">{m.name}</h1>
      <p className="opacity-70">{m.tagline.es}</p>
      <p className="mt-6 rounded border border-current/20 p-4 text-sm">
        Estado: <b>{m.status}</b> · Fase {m.phase}. Módulo aún no implementado; esta pestaña es su punto de montaje.
      </p>
    </>
  );
}
