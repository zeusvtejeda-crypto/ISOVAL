/* ═══════════════════════════════════════════════════════════════
   BEAUTYSKIN · REAL CLÍNICA ESTÉTICA — DATOS DEL NEGOCIO
   Único lugar a editar. Lo usan la web (index.html) y el CRM (crm/).
   Fuente: página de Facebook /LinaresSkin (nov 2026).
   precio: null  → en la web dice "Cotiza" y en el CRM se captura al cobrar.
   ═══════════════════════════════════════════════════════════════ */
window.NEGOCIO = {
  nombre: 'BeautySkin',
  subtitulo: 'Real Clínica Estética',
  slug: 'beautyskin',
  ciudad: 'Tepic, Nayarit',
  direccion: 'Calle Cedro #15, esq. Av. Jacarandas, Col. Versalles Sur, 63000 Tepic, Nay.',
  mapaUrl: 'https://www.google.com/maps/search/?api=1&query=Calle+Cedro+15+Versalles+Sur+Tepic+Nayarit',
  whatsapp: '523312256402',
  whatsappDisplay: '33 1225 6402',
  email: 'karlalinares12@gmail.com',
  facebook: 'https://www.facebook.com/LinaresSkin/',
  instagram: 'https://www.instagram.com/beautyskin_real_spa/',
  medico: 'Dra. Grecia Angélica Ríos Figueroa',
  medicoCred: 'Médico Cirujano U.A.N. · Céd. Prof. 11499694',
  cofepris: 'COFEPRIS 2318015036X00364 · Aviso de publicidad 2318012002A00075',
  seguidores: '8.2 mil',
  recomendacion: '100% recomendado (15 opiniones en Facebook)',
  horario: 'Lun–Vie 10:00–19:00 · Sáb 10:00–15:00', // EDITAR si cambia
  horas: { 1:[10,19], 2:[10,19], 3:[10,19], 4:[10,19], 5:[10,19], 6:[10,15] }, // 0 = domingo cerrado
  valoracion: 300,          // se descuenta del total del tratamiento
  pinInicial: '1234'        // PIN del CRM (cámbialo dentro del CRM → Ajustes)
};

window.CATALOGO = [
  // ── Valoración
  {id:'valoracion', tipo:'servicio', cat:'Valoración', nombre:'Valoración médica', min:30, precio:300, seguimiento:7, desc:'Revisión con la doctora y plan a tu medida. Los $300 se descuentan del total de tu tratamiento.', top:true},
  // ── Médico estético (aplica la Dra.)
  {id:'toxina',  tipo:'servicio', cat:'Médico estético', nombre:'Toxina botulínica', min:30, precio:3500, seguimiento:15, desc:'Frente, entrecejo, patas de gallo y bunny lines. Incluye retoque a los 15 días. Hasta 3 meses sin intereses.', top:true},
  {id:'babybotox', tipo:'servicio', cat:'Médico estético', nombre:'Baby Botox', min:30, precio:null, seguimiento:15, desc:'Microdosis para un acabado natural y preventivo: suaviza sin perder expresión.'},
  {id:'labios',  tipo:'servicio', cat:'Médico estético', nombre:'Aumento de labios', min:45, precio:null, seguimiento:15, desc:'Ácido hialurónico para labios más definidos, hidratados y con volumen natural.', top:true},
  {id:'rino',    tipo:'servicio', cat:'Médico estético', nombre:'Rinomodelación con ácido hialurónico', min:45, precio:null, seguimiento:15, desc:'Perfil nasal más armonioso y punta más elevada, sin cirugía. Resultados inmediatos.'},
  {id:'radiesse',tipo:'servicio', cat:'Médico estético', nombre:'Radiesse®', min:45, precio:null, seguimiento:30, desc:'Bioestimulador: estimula el colágeno, mejora la firmeza y apoya el contorno facial.'},
  // ── Faciales y cosmetología
  {id:'limpieza', tipo:'servicio', cat:'Facial', nombre:'Limpieza facial profunda', min:60, precio:null, seguimiento:30, desc:'Extracción, exfoliación e hidratación. Piel limpia y luminosa desde la primera sesión.', top:true},
  {id:'hollywood',tipo:'servicio', cat:'Facial', nombre:'Hollywood Peel', min:45, precio:950, seguimiento:15, desc:'Peeling con láser y carbón: textura más uniforme, poros menos visibles y menos grasa superficial.'},
  {id:'dermaplaning', tipo:'servicio', cat:'Facial', nombre:'Dermaplaning', min:45, precio:null, seguimiento:30, desc:'Retira células muertas y vello fino. Resultados inmediatos: piel suave y maquillaje perfecto.'},
  {id:'dermapen', tipo:'servicio', cat:'Facial', nombre:'Dermapen con vitaminas', min:60, precio:null, seguimiento:30, desc:'Microagujas + vitaminas para luminosidad, firmeza y textura.'},
  {id:'dermapen-cic', tipo:'servicio', cat:'Facial', nombre:'Dermapen en cicatrices de acné', min:60, precio:null, seguimiento:30, desc:'Protocolo para mejorar marcas y cicatrices de acné sesión a sesión.'},
  {id:'electro',  tipo:'servicio', cat:'Facial', nombre:'Electroporación', min:45, precio:null, seguimiento:21, desc:'Introduce activos en la piel sin agujas: hidratación y nutrición profunda.'},
  {id:'despig',   tipo:'servicio', cat:'Facial', nombre:'Despigmentante facial', min:45, precio:null, seguimiento:21, desc:'Tratamiento para manchas, melasma y tono disparejo.'},
  // ── Corporal
  {id:'axilas',   tipo:'servicio', cat:'Corporal', nombre:'Despigmentante de axilas', min:40, precio:null, seguimiento:21, desc:'Aclara y unifica el tono de axilas de forma segura.'},
  {id:'corporal', tipo:'servicio', cat:'Corporal', nombre:'Moldeo y reductivo corporal', min:60, precio:null, seguimiento:7, desc:'Tratamientos para reducir medidas y reafirmar. Te armamos tu plan en la valoración.'},
  // ── Paquetes
  {id:'pk-hollywood2', tipo:'paquete', cat:'Paquetes', nombre:'Hollywood Peel · 2 sesiones', sesiones:2, servicio:'hollywood', min:45, precio:1450, desc:'Precio regular $950 por sesión: ahorras $450.'}
  // ── Productos: agrégalos desde el CRM → Ajustes (tipo "producto", con stock)
];

/* Promoción vigente (aparece en la barra superior y en la web). activa:false para ocultarla. */
window.PROMO = {
  activa: true,
  titulo: 'Rinomodelación con 10% de descuento',
  texto: 'Agenda tu valoración: los $300 se descuentan del total de tu tratamiento. Sujeto a valoración médica.',
  vence: ''
};

window.waLink = function (texto) {
  return 'https://wa.me/' + window.NEGOCIO.whatsapp + '?text=' + encodeURIComponent(texto || '');
};
