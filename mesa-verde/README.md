# Mesa Verde · Pedidos de comida para entregar en tu salón

Página para que estudiantes (de cualquier universidad) pidan hoy la comida que se
cocina mañana. El cliente elige platillos, indica **universidad, facultad, salón y
horario de entrega**, marca **alergias** y envía el pedido completo por
**WhatsApp** al dueño del negocio. La página muestra "Pedido hecho" con un folio.

El negocio tiene un **panel** (`#/admin`) para subir platillos con imagen, ver
cuántos pedidos hay para cada día (lista y calendario), marcarlos como
entregados y cambiar la configuración (horarios, días, hora de corte, aviso, etc.).

No se muestran precios (se confirman por WhatsApp), salvo que el negocio los active
en el panel.

## Direcciones

| Qué | Dónde |
|---|---|
| Página de pedidos (GitHub Pages) | `https://zeusvtejeda-crypto.github.io/ISOVAL/mesa-verde/` (cuando esta carpeta esté en la rama `main`) |
| Panel del negocio | la misma dirección + `#/admin` |
| WhatsApp que recibe los pedidos | `+52 311 406 4388` (se cambia en `config.js` o en el panel) |

## Cómo funciona para el cliente

1. Elige el día de entrega (mañana, o más adelante si ya pasó la hora de corte).
2. Marca la cantidad de cada platillo.
3. Escribe universidad, facultad/edificio, salón, horario, nombre y WhatsApp.
4. Marca alergias o restricciones y notas.
5. Toca **Enviar pedido por WhatsApp**: se abre WhatsApp con el pedido redactado
   (folio, fecha, horario, salón, platillos, alergias, notas). La página muestra
   **¡Pedido hecho!** con el folio y un botón por si WhatsApp no se abrió.

## Dos modos de funcionamiento

| | Modo local (viene así) | Con Firebase (recomendado) |
|---|---|---|
| Los pedidos llegan por WhatsApp | ✅ | ✅ |
| El menú que sube el negocio lo ven todos | ❌ solo en ese navegador | ✅ |
| Lista y calendario de pedidos | ❌ solo los hechos desde ese navegador | ✅ todos, desde cualquier teléfono |
| Acceso al panel | PIN (`adminPinLocal` en `config.js`, por defecto **7364**) | correo y contraseña por administrador |

El modo local sirve para probar y para recibir pedidos por WhatsApp desde ya.
Para que el dueño vea en su teléfono el menú y la lista de pedidos, conecta Firebase
(gratis, 10 minutos):

### Conectar Firebase

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto** (sin Analytics).
2. En el proyecto: **Agregar app → Web (</>)**. Copia el objeto `firebaseConfig`
   y pégalo en `config.js` en la clave `firebase:` (quita el `null`).
3. **Build → Firestore Database → Crear base de datos** → modo *producción* →
   región `nam5 (us-central)` o la que salga por defecto.
4. En Firestore → pestaña **Rules**: borra todo, pega el contenido de
   `firestore.rules`, **cambia los dos correos** de la lista `esAdmin()` por el tuyo
   y el del dueño, y **Publish**.
5. **Build → Authentication → Get started → Sign-in method → Email/Password →
   Habilitar**.
6. Authentication → **Users → Add user**: crea el correo y contraseña de cada
   administrador (tú y el dueño). Deben ser los mismos correos de las reglas.
7. Authentication → **Settings → User actions**: desactiva *Enable create
   (sign-up)* para que nadie pueda crear cuentas por su cuenta.
8. Authentication → **Settings → Authorized domains**: agrega
   `zeusvtejeda-crypto.github.io`.
9. Sube `config.js` a GitHub. Abre la página con `#/admin`, entra con tu correo y
   en **Platillos** toca **Cargar menú de ejemplo** (o crea los tuyos).

Listo: el panel dirá *Base de datos en vivo* y los pedidos de todos los clientes
aparecerán en **Pedidos** y **Calendario**.

## Panel del negocio (`#/admin`)

- **Pedidos**: navega por día (flechas, "Mañana" o fecha). Muestra cuántos pedidos y
  platillos hay, cuántos tienen alergias, la lista *Para cocinar* (totales por
  platillo) y cada pedido con universidad, salón, horario, alergias y notas.
  Botones: *Marcar listo*, *Entregado*, *Cancelar*, *WhatsApp* al cliente,
  *Enviarme el resumen* (manda al WhatsApp del negocio el resumen del día).
- **Calendario**: mes con el número de pedidos activos por día; toca un día para
  verlos.
- **Platillos**: crear, editar, ocultar, reordenar y eliminar. Cada platillo tiene
  imagen (se reduce sola), nombre, descripción, etiquetas, precio opcional y días
  en los que está disponible.
- **Configuración**: nombre del negocio, WhatsApp, frase, aviso, días con entrega,
  hora de corte, días que se ofrecen, horarios, fechas sin servicio, universidades
  sugeridas, opciones de alergias y si se muestran precios.
- **Equipo**: cambiar el PIN (modo local) o instrucciones para dar acceso a más
  administradores (Firebase).

## Archivos

```
mesa-verde/
├── index.html        página completa (cliente + panel)
├── config.js         WhatsApp, PIN local y configuración de Firebase
├── firestore.rules   reglas de seguridad para Firestore
├── img/              renders 3D de los platillos de ejemplo
└── README.md
```

## Notas

- Para cambiar la dirección (`/mesa-verde/`), renombra la carpeta; el nombre que se
  muestra en la página se cambia en Configuración.
- Las imágenes de ejemplo son renders 3D generados; el negocio puede subir fotos
  reales desde el panel.
- En modo local, el PIN solo protege el panel del dispositivo donde se abre.
- Los pedidos se guardan con folio (por ejemplo `MV-1A2B3C`) y estado
  (nuevo → listo → entregado / cancelado).
