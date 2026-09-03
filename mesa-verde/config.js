/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DEL SITIO — Mesa Verde · pedidos de comida
   Este es el ÚNICO archivo que hay que editar para poner en marcha
   la base de datos compartida. Sin Firebase, la página funciona en
   "modo local": los pedidos siempre llegan por WhatsApp, pero el menú
   y la lista de pedidos solo se guardan en el navegador de cada quien.
═══════════════════════════════════════════════════════════════ */
window.MV_CONFIG = {
  // Identificador interno (no se muestra). Cambiarlo borra los datos locales.
  negocio: "mesa-verde",

  // WhatsApp del dueño del negocio, con código de país (52 = México).
  // Los pedidos se mandan a este número. Se puede cambiar en el panel.
  whatsapp: "523114064388",

  // PIN del panel en modo local (sin Firebase). Cámbialo desde el panel → Equipo.
  adminPinLocal: "7364",

  // ── Firebase (base de datos compartida) ──
  // 1) Crea un proyecto en https://console.firebase.google.com
  // 2) Agrega una app web y copia aquí el objeto "firebaseConfig".
  // 3) Sigue los pasos del README (Firestore, Authentication y reglas).
  // Déjalo en null para seguir en modo local.
  firebase: null
  // firebase: {
  //   apiKey: "AIza...",
  //   authDomain: "tu-proyecto.firebaseapp.com",
  //   projectId: "tu-proyecto",
  //   storageBucket: "tu-proyecto.appspot.com",
  //   messagingSenderId: "1234567890",
  //   appId: "1:1234567890:web:abcdef"
  // }
};
