import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // sin Supabase configurado: no se puede autenticar
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => { list.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: req }); list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); },
    },
  });
  const { data } = await supabase.auth.getUser(); // valida el JWT contra Supabase
  if (!data.user && req.nextUrl.pathname.startsWith("/app")) {
    const to = req.nextUrl.clone(); to.pathname = "/login"; to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}
export const config = { matcher: ["/app/:path*", "/login", "/register", "/onboarding"] };
