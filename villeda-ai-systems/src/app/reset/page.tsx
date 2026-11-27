import Link from "next/link";
import { AuthForm } from "../AuthForm";
import { requestReset } from "../actions";

export default function Page() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <AuthForm action={requestReset} submit="Recuperar contraseña" fields={[{ name: "email", label: "Correo", type: "email", autoComplete: "email" }]} />
      <p className="mt-6 space-x-4 text-sm opacity-80"><Link href="/login">Volver</Link></p>
    </main>
  );
}
