// Comprueba el camino de PRODUCCIÓN del almacén: Redis por HTTP.
// Levantamos un Upstash falso en memoria que habla el mismo protocolo.
for (const v of ["HTTPS_PROXY","https_proxy","HTTP_PROXY","http_proxy"]) delete process.env[v];
process.env.UPSTASH_REDIS_REST_URL = "https://falso.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "t";

const datos = new Map();
let caido = false;
global.fetch = async (url, o = {}) => {
  if (!String(url).includes("falso.upstash.io")) throw new Error("url inesperada");
  if (caido) return new Response("boom", { status: 500 });
  const [cmd, k, v, ...resto] = JSON.parse(o.body);
  const R = (result) => new Response(JSON.stringify({ result }), {
    status: 200, headers: { "Content-Type": "application/json" } });
  if (cmd === "PING") return R("PONG");
  if (cmd === "GET") return R(datos.has(k) ? datos.get(k) : null);
  if (cmd === "DEL") { datos.delete(k); return R(1); }
  if (cmd === "SET") {
    if (resto.includes("NX") && datos.has(k)) return R(null);
    datos.set(k, v); return R("OK");
  }
  return R(null);
};

const a = require("../src/almacen.js");
let fallos = 0;
const revisar = (t, c, d) => { console.log(`${c ? "  ✅" : "  ❌"} ${t}`); if (!c) { fallos++; if (d) console.log("       " + d); } };

(async () => {
  console.log("\n─── Almacén persistente (Redis por HTTP) ───");
  revisar("detecta que hay Redis configurado", a.hayKV);
  revisar("PING responde", (await a.estadoAlmacen()).persistente);

  await a.guardar("x", { hola: "mundo" }, 60);
  const leido = await a.leer("x");
  revisar("guarda y lee objetos", leido?.hola === "mundo", JSON.stringify(leido));
  revisar("sí llegó al Redis (no a memoria)", datos.has("x"));

  revisar("apartar: la 1ª vez sí", (await a.apartar("dup", 60)) === true);
  revisar("apartar: la 2ª vez no", (await a.apartar("dup", 60)) === false);

  await a.borrar("x");
  revisar("borra", (await a.leer("x")) === null);

  console.log("\n─── Si el Redis se cae a media operación ───");
  caido = true;
  await a.guardar("y", { sigo: "vivo" }, 60);
  const tras = await a.leer("y");
  revisar("el asistente NO se cae: usa el respaldo", tras?.sigo === "vivo", JSON.stringify(tras));
  revisar("/salud lo reporta como no persistente", !(await a.estadoAlmacen()).persistente);

  console.log(`\n${fallos === 0 ? "TODO BIEN ✅" : `FALLARON ${fallos} ⚠️`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
})();
