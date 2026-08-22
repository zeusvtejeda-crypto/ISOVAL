# Asistente de WhatsApp multi-negocio

Un solo asistente que atiende **varios negocios** por WhatsApp, cada uno con su
propia personalidad e información. Usa la **API oficial de Meta (WhatsApp Cloud
API)** para los mensajes y una IA para redactar las respuestas — por defecto
**Gemini (gratis, sin tarjeta)**, con la opción de cambiar a **Claude
(Anthropic, de paga)** si más adelante quieres mejor calidad.

Negocios incluidos de fábrica (los editas tú):

- 🏗️ **Isoval** — `businesses/isoval.js` (arquitectura y construcción, Tepic)
- 🛏️ **Bases Box Tepic** — `businesses/camas.js`
- 💪 **The Fithouse** — `businesses/fithouse.js`
- 🏠 **Inmobiliaria** — `businesses/inmobiliaria.js` (viene apagada; enciéndela cuando abras el negocio)

---

## 🧠 ¿Cómo funciona? (en simple)

```
Cliente escribe por WhatsApp
        │
        ▼
   Meta (Cloud API)  ──►  tu servidor  ──►  identifica el NEGOCIO
                                              │   (según el número que recibió)
                                              ▼
                                    Gemini (o Claude) redacta la respuesta
                                              │
                                              ▼
                                     se envía de vuelta por WhatsApp
```

Cada **número de WhatsApp** se "adjudica" a un negocio en su perfil. Así, con
un mismo servidor, atiendes camas, gym e inmobiliaria a la vez. Agregar un
negocio nuevo = agregar un archivo de perfil.

---

## 🤖 Qué hace solo (sin que tú estés encima)

Esta es la parte que hace que sea un asistente **autónomo** y no nada más un
contestador:

| Situación | Qué hace |
|---|---|
| El cliente pide **hablar con una persona**, se queja o pide factura | Te manda un WhatsApp **a tu celular** con el número del cliente y qué necesita, se calla en esa conversación y le da una respuesta de cierre al cliente (no lo deja colgado) |
| **Tú entras a contestar** a mano | Se hace a un lado y no habla encima de ti (3 h por defecto) |
| El cliente manda una **nota de voz o una foto** | Contesta con educación que por ahí no puede abrirla, en vez de quedarse mudo. Una sola vez por hora, para no dar lata |
| **Meta reintenta** el mismo mensaje | Lo reconoce y no contesta dos veces |
| El servidor **se reinicia** a media conversación | No pierde el hilo (si configuraste la memoria; ver abajo) |
| El asistente **se rompe** (token vencido, etc.) | Un monitor lo revisa cada 15 min y te avisa |

### Órdenes que le puedes mandar desde tu celular

Le escribes **al número del negocio** desde el celular que pusiste en
`WHATSAPP_ADMIN`, y te obedece en vez de contestarte como cliente:

```
pausa 3339998877     → deja de contestarle a ese cliente
sigue 3339998877     → vuelve a atenderlo
estado               → te dice si todo está funcionando
ayuda                → la lista de órdenes
```

---

## ✅ Lo que TÚ editas (sin tocar el código)

Todo lo que cambia por negocio está en la carpeta **`businesses/`**. Abre por
ejemplo `businesses/camas.js` y edita los textos entre comillas:

| Campo | Para qué sirve |
|---|---|
| `activo` | `true`/`false` para prender o apagar ese negocio |
| `nombrePublico` | El nombre que el asistente puede decir (déjalo `""` si no hay nombre oficial) |
| `saludo` | Primer mensaje de bienvenida |
| `info` | TODO lo que el asistente debe saber: productos, precios, horarios, envíos… |
| `tono` | La personalidad con la que contesta |
| `contactoHumano` | Cuándo pasar la charla a una persona real |
| `escalarA` | Las frases que **siempre** te avisan a ti (ej: "queja", "factura") |
| `avisarA` | A qué celular le avisa. Vacío = usa `WHATSAPP_ADMIN` |
| `phoneNumberId` | Se llena al conectar el número de WhatsApp (ver abajo) |

Para **agregar un negocio nuevo**: copia un archivo de `businesses/`, cámbiale
el `id` y los textos, y agrégalo en `businesses/index.js`. Listo.

---

## 🚀 Puesta en marcha

### 1) Probar en tu compu (sin WhatsApp todavía)

```bash
cd whatsapp-assistant
npm install
cp .env.example .env      # y pon tu GEMINI_API_KEY dentro
npm run chat              # platica con el asistente en la terminal
npm test                  # comprueba que todo lo autónomo funciona
```

> Sin key configurada funciona en "modo prueba" (respuestas de ejemplo), útil
> para ver el flujo. Con la key, responde con IA real.
>
> **Gemini (gratis, recomendado):** entra a https://aistudio.google.com/apikey,
> inicia sesión con una cuenta de Google, dale **Create API key**. No pide
> tarjeta. Tiene un límite de peticiones por minuto, más que suficiente para
> un negocio chico.
>
> **Claude (de paga, opcional):** si prefieres mejor calidad y no te importa
> pagar por uso, saca tu key en https://console.anthropic.com → *API Keys*
> (hay que agregar crédito en *Billing* antes de que funcione) y pon
> `AI_PROVIDER=anthropic` en el `.env`.

Puedes abrir un negocio específico: `npm run chat -- fithouse`

### 2) Publicar el servidor en internet (Vercel)

WhatsApp necesita una URL pública `https://`. Tu sitio de GitHub Pages **no**
sirve para esto (es estático). Este proyecto ya viene listo para **Vercel**
(gratis), que es lo más rápido:

1. Entra a [vercel.com](https://vercel.com) y crea cuenta con tu GitHub.
2. **Add New… › Project** y elige este repositorio.
3. ⚠️ **Root Directory: `whatsapp-assistant`** — es el paso que más se olvida.
   La raíz del repo es la página web, no el asistente. Si no lo cambias,
   Vercel publica el sitio estático y el webhook nunca responde.
4. En **Environment Variables** pega las de tu `.env` (mínimo:
   `AI_PROVIDER`, `GEMINI_API_KEY`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`,
   `WHATSAPP_ADMIN`, `DEFAULT_BUSINESS`).
5. **Deploy**. Te queda una URL tipo `https://tu-asistente.vercel.app`.
6. Ábrela: debe decir *"Asistente de WhatsApp activo ✅"*. Y abre
   `https://tu-asistente.vercel.app/salud` para ver el diagnóstico completo.

> 🔴 **Cada vez que cambies una variable en Vercel hay que volver a
> desplegar.** Vercel NO se las aplica a un despliegue que ya existe. En
> *Deployments*, el último → **Redeploy**. Media tarde se pierde aquí.

### 3) Conectar WhatsApp (Meta Cloud API)

1. Entra a **[developers.facebook.com](https://developers.facebook.com)** →
   crea una **App** de tipo *Business* → agrega el producto **WhatsApp**.
2. En **WhatsApp → API Setup** verás el **Phone number ID** y un token
   temporal (dura 24 h, solo para probar).
3. Saca el token **permanente**, que es el que aguanta:
   **Meta Business Settings** (business.facebook.com/settings) del
   **portafolio dueño de la cuenta de WhatsApp** →
   **Usuarios del sistema** → crea uno → **Agregar activos**:
   - pestaña **Cuentas de WhatsApp** → marca la cuenta → **Control total**
   - pestaña **Apps** → marca la app del asistente
   → **Generar token** con los permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`.

   > ⚠️ El error clásico: el usuario del sistema tiene que estar **dentro del
   > mismo portafolio que es dueño de la cuenta de WhatsApp**. Si está en
   > otro, el botón "Agregar activos" ni siquiera te muestra la cuenta y
   > parece que Meta está fallando. Un token con todos los permisos en verde
   > pero **sin cuenta asignada** no puede mandar nada. `/salud` detecta
   > exactamente ese caso y te lo dice.

4. Copia los datos a las variables de Vercel:
   - `WHATSAPP_TOKEN` = el token permanente
   - `PHONE_ID_CAMAS` (o el que corresponda) = el Phone number ID
5. En **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://tu-asistente.vercel.app/webhook`
   - **Verify token**: el mismo texto que pusiste en `WHATSAPP_VERIFY_TOKEN`
   - **Verify and save** (tu servidor debe estar en línea).
   - Suscríbete al campo **messages**.
   - Si te aparece **message_echoes**, suscríbete también: es lo que hace que
     el asistente se calle solo cuando tú entras a contestar a mano. Si no
     aparece, no pasa nada: te queda la orden `pausa <número>`.
6. Manda un WhatsApp al número del negocio… ¡y el asistente responde! 🎉

> **Para empezar con un solo número:** deja `PHONE_ID_*` vacíos y pon
> `DEFAULT_BUSINESS=camas` (o el negocio que quieras). Cuando tengas un número
> por negocio, llena cada `PHONE_ID_*` y quita `DEFAULT_BUSINESS`.

### 4) Memoria que no se borra (5 minutos, gratis)

En Vercel el servidor se apaga y se prende todo el tiempo. Sin esto, el cliente
dice "queen" y al mensaje siguiente el asistente ya no se acuerda.

1. Crea una cuenta en [upstash.com](https://upstash.com) → **Create Database**
   (Redis, plan gratis).
2. En la pestaña **REST API** copia `UPSTASH_REDIS_REST_URL` y
   `UPSTASH_REDIS_REST_TOKEN`.
3. Pégalas en las variables de Vercel y **redespliega**.

> Alternativa: desde el panel de Vercel, **Storage › KV** te lo conecta solo y
> rellena las variables sin que copies nada. El código acepta los dos.
>
> Si no configuras nada, el asistente **funciona igual**, solo que olvida el
> hilo al reiniciarse. `/salud` te dice en cuál de los dos estás.

### 5) Que te avise si se cae (el monitor)

En GitHub: **Settings › Secrets and variables › Actions › New repository secret**

| Secreto | Valor |
|---|---|
| `SALUD_URL` | `https://tu-asistente.vercel.app/salud` |
| `ALERTA_PHONE_ID` | (opcional) el phone_number_id del negocio |
| `ALERTA_TOKEN` | (opcional) el token de Meta |
| `ALERTA_PARA` | (opcional) tu celular, solo dígitos |

Con eso, `.github/workflows/monitor-asistente.yml` revisa `/salud` cada 15
minutos. Si algo se rompe, GitHub te manda correo — y si pusiste los tres
secretos opcionales, además te llega un WhatsApp.

> Dos detalles de GitHub: los horarios **solo corren en la rama `main`**, y si
> el repo pasa 60 días sin actividad GitHub apaga el horario y te avisa por
> correo.
>
> Si prefieres no usar GitHub: [UptimeRobot](https://uptimerobot.com) es
> gratis, apúntalo a la misma URL `/salud` y listo.

### 6) La plantilla del aviso (para que no se pierda)

Meta solo te deja mandar **texto libre a quien te escribió en las últimas
24 h**. Como tú casi nunca le escribes al número del negocio, el aviso de
"un cliente te necesita" es justo el que más fácil se cae.

Para que no se pierda: en **WhatsApp Manager → Plantillas de mensajes** crea
una plantilla de categoría *Utility*, por ejemplo:

```
Nombre: aviso_asistente
Idioma: Español (MX)
Cuerpo:  Un cliente necesita atencion en {{1}}. Numero: {{2}}
```

Cuando Meta la apruebe, pon `PLANTILLA_AVISO=aviso_asistente` en Vercel y
redespliega. El asistente intenta primero el texto normal y, si Meta lo
rechaza por las 24 h, reintenta con la plantilla.

> Truco mientras tanto: si de vez en cuando le mandas un WhatsApp al número
> del negocio (por ejemplo `estado`), la ventana de 24 h se reabre sola.

---

## 🔀 Cómo se asigna cada número a un negocio

Cada número de WhatsApp tiene un **Phone number ID** único en Meta. Pones ese
id en la variable del negocio correspondiente:

```
PHONE_ID_CAMAS=123456789        -> los WhatsApp de ese número los atiende "camas"
PHONE_ID_FITHOUSE=987654321     -> los de ese otro número, "fithouse"
```

El servidor mira a qué número llegó cada mensaje y lo manda al negocio correcto.

---

## 📁 Estructura

```
whatsapp-assistant/
├── businesses/         ← PERFILES editables (lo que tú tocas)
│   ├── isoval.js
│   ├── camas.js
│   ├── fithouse.js
│   ├── inmobiliaria.js
│   └── index.js        ← registro de negocios
├── src/
│   ├── server.js       ← arranca el puerto (Render, tu compu)
│   ├── app.js          ← recibe los WhatsApp y decide qué hacer
│   ├── router.js       ← decide qué negocio atiende
│   ├── brain.js        ← redacta la respuesta (Gemini o Claude)
│   ├── escalacion.js   ← avisa a una persona y pausa el bot
│   ├── whatsapp.js     ← envía la respuesta por WhatsApp
│   ├── memory.js       ← recuerda el hilo de cada conversación
│   ├── almacen.js      ← dónde se guarda eso (Redis o memoria)
│   ├── salud.js        ← el diagnóstico de /salud
│   ├── config.js       ← lee las variables de entorno
│   └── simulator.js    ← chat de prueba en la terminal
├── pruebas/            ← npm test
├── .env.example        ← plantilla de configuración
└── package.json
```

---

## 📝 Notas y siguientes pasos

- **Solo texto:** el asistente lee y escribe texto. Si le mandan un audio o una
  foto, contesta con educación pidiendo que se lo escriban. Transcribir audios
  se puede agregar después.
- **Costo:** Meta Cloud API es gratis hasta cierto volumen de conversaciones al
  mes. Con `AI_PROVIDER=gemini` el cerebro no cuesta nada (límite de
  peticiones por minuto). Si cambias a Claude, cobra por uso. Upstash tiene
  plan gratis de sobra para un negocio chico.
- **Privacidad:** nunca subas tu `.env` a git (ya está en `.gitignore`).
- **Falta por llenar:** `businesses/camas.js` todavía no tiene precios, zonas
  de entrega ni formas de pago. Mientras estén vacíos, el asistente NO inventa
  montos: ofrece cotizar y te pasa el contacto. En cuanto los pongas, cierra
  ventas solo.
