import fs from "node:fs";
import path from "node:path";
import Site from "@/components/Site";

export default function Page() {
  const dir = path.join(process.cwd(), "public", "fotos");
  const gallery = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort()
    .map((f) => `/fotos/${f}`);
  return <Site gallery={gallery} />;
}
