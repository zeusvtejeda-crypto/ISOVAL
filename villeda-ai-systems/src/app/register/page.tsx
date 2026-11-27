import Link from "next/link";
import { AuthForm } from "../AuthForm";
import { register } from "../actions";

export default function Page() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <AuthForm action={register} submit="Crear cuenta" fields={[{ name: "email", label: "Correo", type: "email", autoComplete: "email" }, { name: "password", label: "Contraseña (mín. 8)", type: "password", autoComplete: "new-password" }]} />
      <p className="mt-6 space-x-4 text-sm opacity-80"><Link href="/login">Ya tengo cuenta</Link></p>
    </main>
  );
}
