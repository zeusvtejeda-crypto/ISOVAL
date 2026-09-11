// Línea del tiempo y sección "Nosotros".
// Agrega fotos a /public/fotos/ y suma objetos aquí. Layouts disponibles:
// "text" | "large" | "duo" | "polaroid" | "side" | "video"
export type Memory = {
  id: string;
  section: "historia" | "nosotros";
  layout: "text" | "large" | "duo" | "polaroid" | "side" | "video";
  year?: string;
  title?: string;
  caption?: string;
  image?: string;
  images?: string[];
  video?: string;
  poster?: string;
};

export const memories: Memory[] = [
  {
    id: "inicio",
    section: "historia",
    layout: "text",
    year: "1986",
    title: "11 de septiembre",
    caption:
      "Un 11 de septiembre nació alguien que iba a cambiarlo todo. Ese día empezó esta historia, aunque todavía no lo supiéramos.",
  },
  {
    id: "foto-vieja",
    section: "historia",
    layout: "large",
    year: "Los primeros capítulos",
    title: "Donde empezó lo nuestro",
    caption:
      "Esta foto tiene años guardada, pero la sonrisa es la misma de siempre.",
    image: "/fotos/foto-08.jpg",
  },
  {
    id: "nieve",
    section: "historia",
    layout: "polaroid",
    year: "La nieve",
    caption: "Aventuras de esas que no se olvidan.",
    image: "/fotos/foto-10.jpg",
  },
  {
    id: "carretera",
    section: "historia",
    layout: "side",
    year: "Kilómetros contigo",
    title: "Tú al volante",
    caption:
      "Contigo manejando da tanta confianza que hasta el sueño gana. Así se viaja cuando alguien te cuida el camino.",
    image: "/fotos/foto-01.jpg",
  },
  {
    id: "viajes",
    section: "historia",
    layout: "duo",
    year: "Los viajes",
    caption: "De la alberca a las alitas: contigo cualquier plan es bueno.",
    images: ["/fotos/foto-09.jpg", "/fotos/foto-02.jpg"],
  },
  {
    id: "video-recuerdo",
    section: "historia",
    layout: "video",
    year: "Un recuerdo en movimiento",
    video: "/videos/video-02.mp4",
    poster: "/videos/video-02-poster.jpg",
  },
  {
    id: "dias-buenos",
    section: "historia",
    layout: "side",
    year: "Los días buenos",
    title: "Tu manera de disfrutar",
    caption:
      "Donde sea que estés, haces que el plan valga la pena. Eso también se aprende de ti.",
    image: "/fotos/foto-03.jpg",
  },
  // ---- NOSOTROS ----
  {
    id: "nosotros-1",
    section: "nosotros",
    layout: "large",
    title: "Tú y yo",
    caption: "Gracias por cada plática en el camino.",
    image: "/fotos/foto-11.jpg",
  },
  {
    id: "hermano",
    section: "nosotros",
    layout: "text",
    year: "El mejor regalo",
    title: "Gracias por el hermano",
    caption:
      "Gracias por darme al hermano que vino a completar ese espacio que tanto quería. Aunque de repente sea un dolor de cabeza jajaja… es de lo mejor que me has dado.",
  },
  {
    id: "nosotros-video",
    section: "nosotros",
    layout: "video",
    video: "/videos/video-01.mp4",
    poster: "/videos/video-01-poster.jpg",
  },
];

// Frases que aparecen entre las fotos de "Nosotros".
export const frasesNosotros = [
  "Gracias por estar.",
  "Por enseñarme.",
  "Por aconsejarme.",
  "Por hacerme reír.",
  "Por cada viaje.",
  "Por cada historia.",
  "Por los momentos importantes.",
  "Y también por los que parecían normales.",
  "Porque después descubrimos que esos eran de los mejores.",
];

// Videos extra (sección "Recuerdos en movimiento").
export const extraVideos = [
  { video: "/videos/video-03.mp4", poster: "/videos/video-03-poster.jpg" },
  { video: "/videos/video-04.mp4", poster: "/videos/video-04-poster.jpg" },
];
