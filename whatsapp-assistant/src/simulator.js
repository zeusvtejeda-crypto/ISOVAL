// ═══════════════════════════════════════════════════════════════
//  SIMULADOR DE CHAT (para probar en la terminal, sin WhatsApp)
//
//  Uso:
//    npm run chat                -> elige negocio y platica
//    npm run chat -- fithouse    -> abre directo ese negocio
//
//  Sirve para ver cómo contesta el asistente ANTES de conectar
//  WhatsApp. Si pusiste ANTHROPIC_API_KEY responde con IA real;
//  si no, responde en "modo prueba".
// ═══════════════════════════════════════════════════════════════
const readline = require("readline");
const { negocios, porId } = require("../businesses");
const { generarRespuesta } = require("./brain");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const pregunta = (q) => new Promise((r) => rl.question(q, r));

async function main() {
  let negocio = porId[process.argv[2]];

  if (!negocio) {
    console.log("\nNegocios disponibles:");
    negocios.forEach((n, i) =>
      console.log(
        `  ${i + 1}) ${n.id}${n.activo ? "" : " (inactivo)"}`
      )
    );
    const sel = await pregunta("\nElige un negocio (número o id): ");
    negocio =
      porId[sel.trim()] || negocios[Number(sel.trim()) - 1] || negocios[0];
  }

  const usuario = "simulador-" + Date.now();
  console.log(
    `\n💬 Chateando con el asistente de "${negocio.id}". ` +
      `Escribe "salir" para terminar.\n`
  );

  while (true) {
    const texto = await pregunta("Tú: ");
    if (["salir", "exit", "quit"].includes(texto.trim().toLowerCase())) break;
    if (!texto.trim()) continue;
    const respuesta = await generarRespuesta(negocio, usuario, texto.trim());
    console.log(`Asistente: ${respuesta}\n`);
  }

  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
});
