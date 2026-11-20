/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN — Taquería (pedidos por WhatsApp + caja)
   Único archivo a editar: nombre, WhatsApp, horario, envío y menú.
═══════════════════════════════════════════════════════════════ */
window.TQ_CONFIG = {
  nombre: "Taquería El Fogón",
  lema: "Al pastor, al carbón y con salsa de la casa",
  ciudad: "Tepic, Nay.",
  // WhatsApp del negocio: 52 + 10 dígitos. Aquí llegan los pedidos.
  whatsapp: "520000000000",
  // PIN para entrar a la caja (#/caja).
  pinCaja: "2580",

  // Horario por día (0 = domingo … 6 = sábado). null = cerrado.
  // Si el cierre es menor que la apertura, cruza la medianoche (ej. 18:00–01:00).
  horario: {
    0: ["13:00", "23:00"],
    1: null,
    2: ["18:00", "00:30"],
    3: ["18:00", "00:30"],
    4: ["18:00", "00:30"],
    5: ["18:00", "02:00"],
    6: ["13:00", "02:00"]
  },
  // Permitir pedidos con el local cerrado (se envían "para cuando abra").
  pedidosCerrado: false,

  domicilio: {
    activo: true,
    costo: 25,          // costo de envío
    gratisDesde: 250,   // envío gratis desde este subtotal (0 = nunca)
    minimo: 100,        // pedido mínimo a domicilio
    zona: "Colonias a 3 km del local"
  },
  transferencia: "BBVA · CLABE 000 000 0000000000 0 · A nombre de: El Fogón",

  // Grupos de opciones que pueden usar los productos.
  // tipo "uno" = elige una opción (la primera es la de por defecto); "varios" = casillas.
  grupos: {
    tortilla: { titulo: "Tortilla", tipo: "uno", ops: [["Maíz", 0], ["Harina", 3]] },
    todo: { titulo: "¿Cómo lo quieres?", tipo: "varios", ops: [["Sin cebolla", 0], ["Sin cilantro", 0], ["Sin piña", 0]] },
    todoSimple: { titulo: "¿Cómo lo quieres?", tipo: "varios", ops: [["Sin cebolla", 0], ["Sin cilantro", 0]] },
    extras: { titulo: "Extras", tipo: "varios", ops: [["Queso", 10], ["Aguacate", 12], ["Doble carne", 15]] },
    salsa: { titulo: "Salsa aparte", tipo: "uno", ops: [["Roja", 0], ["Verde", 0], ["Habanero", 0], ["Sin salsa", 0]] },
    agua: { titulo: "Sabor", tipo: "uno", ops: [["Horchata", 0], ["Jamaica", 0], ["Limón con chía", 0]] },
    refresco: { titulo: "Sabor", tipo: "uno", ops: [["Coca-Cola", 0], ["Coca sin azúcar", 0], ["Sprite", 0], ["Manzanita", 0]] }
  },

  categorias: ["Tacos", "Especiales", "Órdenes", "Bebidas"],

  // Menú. agotado: true lo oculta del pedido sin borrarlo.
  menu: [
    { id: "pastor", cat: "Tacos", nombre: "Al pastor", desc: "Del trompo, con piña", precio: 18, emoji: "🌮", grupos: ["tortilla", "todo", "salsa", "extras"], top: true },
    { id: "asada", cat: "Tacos", nombre: "Asada", desc: "Res al carbón", precio: 22, emoji: "🥩", grupos: ["tortilla", "todoSimple", "salsa", "extras"], top: true },
    { id: "suadero", cat: "Tacos", nombre: "Suadero", desc: "Suave y dorado en su jugo", precio: 20, emoji: "🌮", grupos: ["tortilla", "todoSimple", "salsa", "extras"] },
    { id: "tripa", cat: "Tacos", nombre: "Tripa", desc: "Bien doradita", precio: 24, emoji: "🔥", grupos: ["tortilla", "todoSimple", "salsa"] },
    { id: "chorizo", cat: "Tacos", nombre: "Chorizo", desc: "Chorizo de la casa", precio: 18, emoji: "🌶️", grupos: ["tortilla", "todoSimple", "salsa", "extras"] },
    { id: "campechano", cat: "Tacos", nombre: "Campechano", desc: "Asada con chorizo", precio: 24, emoji: "🌮", grupos: ["tortilla", "todoSimple", "salsa", "extras"] },
    { id: "gringa", cat: "Especiales", nombre: "Gringa", desc: "Harina, pastor, queso y piña", precio: 55, emoji: "🧀", grupos: ["todo", "salsa", "extras"], top: true },
    { id: "volcan", cat: "Especiales", nombre: "Volcán", desc: "Tostada con queso gratinado y asada", precio: 38, emoji: "🌋", grupos: ["todoSimple", "salsa"] },
    { id: "quesadilla", cat: "Especiales", nombre: "Quesadilla con carne", desc: "Elige la carne en notas", precio: 50, emoji: "🫓", grupos: ["tortilla", "salsa", "extras"] },
    { id: "alambre", cat: "Especiales", nombre: "Alambre", desc: "Asada, tocino, pimiento, cebolla y queso + 5 tortillas", precio: 125, emoji: "🍳", grupos: ["tortilla", "salsa"] },
    { id: "orden5", cat: "Órdenes", nombre: "Orden de 5 al pastor", desc: "Con cebolla, cilantro y piña", precio: 85, emoji: "🍽️", grupos: ["tortilla", "todo", "salsa"] },
    { id: "kilo", cat: "Órdenes", nombre: "Kilo de pastor", desc: "Con tortillas, salsas, cebolla, cilantro y piña", precio: 420, emoji: "📦", grupos: ["tortilla"] },
    { id: "agua", cat: "Bebidas", nombre: "Agua fresca 1 L", desc: "", precio: 35, emoji: "🥤", grupos: ["agua"] },
    { id: "refresco", cat: "Bebidas", nombre: "Refresco 600 ml", desc: "", precio: 28, emoji: "🥫", grupos: ["refresco"] }
  ]
};
