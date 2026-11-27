import Link from "next/link";
import { AuthForm } from "../AuthForm";
import { login } from "../actions";

export default function Page() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <AuthForm action={login} submit="Iniciar sesión" fields={[{ name: "email", label: "Correo", type: "email", autoComplete: "email" }, { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" }]} />
      <p className="mt-6 space-x-4 text-sm opacity-80"><Link href="/register">Crear cuenta</Link><Link href="/reset">Olvidé mi contraseña</Link></p>
    </main>
  );
}
