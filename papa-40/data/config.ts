// Configuración general. Edita aquí, no en los componentes.
export const config = {
  birthDate: "1986-09-11T00:00:00",
  // Foto principal de la intro:
  heroImage: "/fotos/foto-11.jpg",
  heroCaption: "40 años de historias, recuerdos y momentos que todavía continúan.",
  // Canción de fondo: sube tu mp3 a /public/audio/cancion.mp3.
  // Idea: un cover instrumental de "The Power of Love" o del tema de
  // Volver al Futuro, o algo synthwave ochentero. Si el archivo no
  // existe, el botón de música se oculta solo.
  music: "/audio/cancion.mp3" as string | null,
  // Frase pequeña que acompaña la invitación a poner música:
  musicTagline: "Como en tus películas favoritas: dale play y viajemos en el tiempo ⚡",
  // Mensaje de voz para "Papá, escucha esto": ej. "/audio/mensaje.mp3". Si es null, la sección no aparece.
  voiceNote: null as string | null,
};
