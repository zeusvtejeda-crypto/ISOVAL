/** Importaciones de Vite con `?inline`: el recurso llega como data URI. */
declare module '*?inline' {
  const src: string;
  export default src;
}
