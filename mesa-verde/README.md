# Mesa Verde · página de pedidos de comida

Página para que los clientes (estudiantes de cualquier universidad, o cualquier
persona) pidan hoy la comida que se cocina y se entrega al día siguiente. El
cliente elige platillos, día, horario, salón y universidad, y al enviar se abre
WhatsApp con el pedido completo listo para mandar al negocio. El negocio tiene
un panel (`#/admin`) para ver los pedidos del día, un calendario con el conteo
de pedidos por fecha, y para editar el menú (con fotos), los horarios y los
días de entrega — sin tocar código.

Es un sitio **estático**: un solo archivo `index.html` (HTML + CSS + JS) más
`config.js`. No necesita servidor propio; se puede hospedar en cualquier
sitio que sirva archivos estáticos (GitHub Pages, Netlify, Vercel, etc.) o
verse directamente abriendo `index.html` en el navegador.

## Los dos modos

| | **Modo local** (por defecto) | **Con Firebase** (recomendado para producción) |
|---|---|---|
| Menú y pedidos | Se guardan solo en el navegador de cada quien | Compartidos en tiempo real entre todos los dispositivos |
| Acceso al panel | PIN de 4 a 6 dígitos (mismo para todos) | Correo y contraseña, uno por administrador |
| Cuándo usarlo | Para probar la página o si solo una persona administra desde un celular | Cuando el dueño del negocio y tú necesitan ver y editar lo mismo desde teléfonos distintos |

Los **pedidos siempre llegan por WhatsApp** en los dos modos — esa es la vía
que de verdad le avisa al negocio. La base de datos (local o Firebase) es
solo para que el panel muestre el historial, el calendario y el menú.

## Poner en marcha el modo local (ya funciona así)

1. Abre `config.js` y revisa:
   - `whatsapp`: el número del negocio (52 + 10 dígitos). Ya está puesto el
     que diste: `523114064388`.
   - `adminPinLocal`: el PIN para entrar al panel desde este dispositivo
     (por defecto `7364`; cámbialo cuando quieras desde el panel → **Equipo**).
2. Sube la carpeta `mesa-verde/` completa (con `img/`) a tu hosting estático,
   o ábrela directo con `index.html`.
3. Ve a `tusitio.com/#/admin`, entra con el PIN, y en la pestaña **Platillos**
   da clic en "Cargar menú de ejemplo" para arrancar con 6 platillos ya
   armados (edítalos o bórralos cuando quieras).

**Límite del modo local:** el menú y los pedidos que ve el panel solo viven en
el navegador donde se capturaron. Si el dueño del negocio entra desde su
celular, no va a ver lo que tú guardaste desde tu compu. Para compartirlo,
conecta Firebase (siguiente sección).

## Conectar Firebase (base de datos compartida)

Con esto, tú y el dueño del negocio ven y editan el mismo menú y los mismos
pedidos desde cualquier dispositivo, en tiempo real. Es gratis para este
tamaño de uso (plan Spark de Firebase).

### 1) Crear el proyecto

1. Entra a [console.firebase.google.com](https://console.firebase.google.com)
   y da clic en **Crear proyecto**. Ponle el nombre que quieras (ej. "Mesa
   Verde Pedidos") y sigue los pasos (puedes desactivar Google Analytics).
2. Dentro del proyecto, en el menú lateral entra a **Compilación → Firestore
   Database** → **Crear base de datos**. Elige la región más cercana (por
   ejemplo `us-central` o `southamerica-east1`) y empieza en **modo de
   producción** (las reglas que vas a pegar más abajo son las que protegen
   los datos).
3. Entra a **Compilación → Authentication** → **Comenzar** → habilita el
   proveedor **Correo electrónico/contraseña**.
4. En **Authentication → Users**, da clic en **Add user** y crea una cuenta
   para ti y otra para el dueño del negocio (correo + contraseña). Esas son
   las cuentas con las que van a entrar al panel.
5. En el menú lateral, junto a "Descripción general del proyecto", da clic
   en el icono **`</>`** (agregar app web). Ponle un apodo (ej. "sitio") y
   da clic en **Registrar app**. Firebase te muestra un bloque de código con
   `const firebaseConfig = { apiKey: "...", ... }` — copia esos valores.

### 2) Pegar la configuración

Abre `config.js` y reemplaza `firebase: null` por el objeto que copiaste:

```js
firebase: {
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
}
```

Guarda y vuelve a subir `config.js` a tu hosting (o recarga la página si la
abriste local). El indicador del panel debe decir "Base de datos en vivo".

### 3) Publicar las reglas de seguridad

Las reglas deciden quién puede leer y escribir cada cosa: cualquiera puede
**crear** un pedido (así funciona el formulario público, sin que el cliente
inicie sesión) y ver el menú, pero solo los administradores pueden **leer los
pedidos**, editar el menú o cambiar la configuración.

1. Abre `firestore.rules` en este proyecto y **cambia los correos** que
   están dentro de la función `esAdmin()` (al inicio del archivo) por el
   tuyo y el del dueño del negocio — deben ser exactamente los correos que
   creaste en Authentication.
2. En la consola de Firebase, ve a **Firestore Database → Reglas**, borra lo
   que haya y pega el contenido completo de `firestore.rules`.
3. Da clic en **Publicar**.

### 4) Cargar el menú por primera vez

Con Firebase ya conectado, entra a `tusitio.com/#/admin`, inicia sesión con
tu correo, ve a **Platillos** y da clic en **"Cargar menú de ejemplo"** (solo
aparece si el menú está vacío), o crea tus platillos desde cero con **"+
Nuevo platillo"**.

### 5) Dar acceso a más personas

Repite el paso 4 de "Crear el proyecto" (Authentication → Add user) para cada
persona nueva, y agrega su correo dentro de la función `esAdmin()` en
`firestore.rules` (vuelve a publicar las reglas). Para quitarle el acceso a
alguien, bórralo de Authentication y de esa lista.

## Cómo se calcula "para mañana"

- `corte` en Configuración (por defecto `20:00`): antes de esa hora, el día
  más próximo que se ofrece es mañana; después, pasa a ser pasado mañana.
- `diasEntrega`: los días de la semana en que el negocio entrega.
- `diasAdelante`: cuántos días próximos (contando solo los de `diasEntrega`)
  se le ofrecen al cliente para elegir.
- `cerrados`: fechas puntuales sin servicio (por ejemplo un feriado), aunque
  caigan en un día que normalmente sí tiene entrega.
- Cada platillo puede además limitarse a ciertos días de la semana (por
  ejemplo, un platillo "solo martes") con el campo **"Disponible solo estos
  días"** al editarlo.

## Estructura del proyecto

```
mesa-verde/
├── index.html         # todo el sitio: HTML + CSS + JS
├── config.js           # lo único que hay que editar para instalarlo
├── firestore.rules     # reglas de seguridad de Firebase (opcional)
└── img/                 # fotos de los platillos de ejemplo
```

No hay build ni dependencias: `index.html` funciona tal cual, abierto
localmente o subido a cualquier hosting estático.
