import { AuthForm } from "../AuthForm";
import { createWorkspace } from "../actions";

export default function Page() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Crear espacio de trabajo</h1>
      <AuthForm action={createWorkspace} submit="Crear espacio de trabajo" fields={[{ name: "name", label: "Nombre de tu negocio o proyecto", type: "text" }]} />
      <p className="mt-6 space-x-4 text-sm opacity-80"></p>
    </main>
  );
}
