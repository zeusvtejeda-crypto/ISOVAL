# Asistente de WhatsApp multi-negocio

Un solo asistente que atiende **varios negocios** por WhatsApp, cada uno con su
propia personalidad e información. Usa la **API oficial de Meta (WhatsApp Cloud
API)** para los mensajes y una IA para redactar las respuestas — por defecto
**Gemini (gratis, sin tarjeta)**, con la opción de cambiar a **Claude
(Anthropic, de paga)** si más adelante quieres mejor calidad.

Negocios incluidos de fábrica (los editas tú):

- 🏗️ **Isoval** — `businesses/isoval.js` (arquitectura y construcción, Tepic)
- 🛏️ **Bases Box Tepic** — `businesses/camas.js` (bases para cama tipo box; el perfil ya trae dirección, horario, tonos y medidas reales)
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

## ✅ Lo que TÚ editas (sin tocar el código)

Todo lo que cambia por negocio está en la carpeta **`businesses/`**. Abre por
ejemplo `businesses/fithouse.js` y edita los textos entre comillas:

| Campo | Para qué sirve |
|---|---|
| `activo` | `true`/`false` para prender o apagar ese negocio |
| `nombrePublico` | El nombre que el asistente puede decir (déjalo `""` si no hay nombre oficial) |
| `saludo` | Primer mensaje de bienvenida |
| `info` | TODO lo que el asistente debe saber: productos, precios, horarios, envíos… |
| `tono` | La personalidad con la que contesta |
| `contactoHumano` | Cuándo pasar la charla a una persona real |
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

### 2) Publicar el servidor en internet

WhatsApp necesita una URL pública `https://`. Tu sitio de GitHub Pages **no**
sirve para esto (es estático). Sube esta carpeta a un hosting que corra Node,
por ejemplo **Render** o **Railway** (ambos tienen plan gratis para empezar):

1. Crea un servicio web nuevo apuntando a la carpeta `whatsapp-assistant`.
2. Comando de inicio: `npm start`
3. En "Environment / Variables", pon las mismas variables del `.env`
   (`AI_PROVIDER`, `GEMINI_API_KEY`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, etc.).
4. Al desplegar te dará una URL, ej: `https://tu-asistente.onrender.com`

### 3) Conectar WhatsApp (Meta Cloud API)

1. Entra a **[developers.facebook.com](https://developers.facebook.com)** →
   crea una **App** de tipo *Business* → agrega el producto **WhatsApp**.
2. En **WhatsApp → API Setup** verás:
   - un **token temporal** (para pruebas) y cómo generar uno **permanente**,
   - el **Phone number ID** del número de prueba.
3. Copia esos datos a tus variables de entorno:
   - `WHATSAPP_TOKEN` = el token de acceso
   - `PHONE_ID_CAMAS` (o el que corresponda) = el Phone number ID
4. En **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://tu-asistente.onrender.com/webhook`
   - **Verify token**: el mismo texto que pusiste en `WHATSAPP_VERIFY_TOKEN`
   - Da clic en **Verify and save** (tu servidor debe estar en línea).
   - Suscríbete al campo **messages**.
5. Manda un WhatsApp al número de prueba… ¡y el asistente responde! 🎉

> **Para empezar con un solo número:** deja `PHONE_ID_*` vacíos y pon
> `DEFAULT_BUSINESS=camas` (o el negocio que quieras). Cuando tengas un número
> por negocio, llena cada `PHONE_ID_*` y quita `DEFAULT_BUSINESS`.

---

## ✅ Encender Bases Box Tepic (lo que falta)

El código ya está listo: el perfil tiene los datos reales del negocio y el
asistente contesta texto, audios, fotos y ubicaciones. Lo que falta es del
lado de **Meta**, y es donde se atora todo el mundo.

**Revisa primero en qué punto vas.** Abre `https://tu-servidor/salud` y te
lo dice en español. Los estados que puede dar para Bases Box:

| Lo que dice /salud | Qué significa | Qué hacer |
|---|---|---|
| `NO_CONECTADO` | Falta el `phone_number_id` | Ponlo en `PHONE_ID_BASESBOX` |
| `TOKEN_VENCIDO` | El token caducó (los de prueba duran 24 h) | Genera uno permanente de Usuario del Sistema |
| `SIN_CUENTA_ASIGNADA` | El token sirve, pero no tiene la cuenta de WhatsApp | Asignar el activo (ver abajo) |
| `SIN_CONFIRMAR` | El token está bien; falta probarlo de verdad | Mándale un WhatsApp al número |
| `OK` | Ya puede contestar | Nada 🎉 |

### El paso que más tiempo hace perder

Si `/salud` dice **`SIN_CUENTA_ASIGNADA`**, el token es válido y los permisos
se ven perfectos en el depurador de Meta, pero aun así no puede mandar nada.
La razón: los *permisos* dicen **qué** puede hacer el token; los *activos*
dicen **sobre qué**, y esos están vacíos.

Lo importante es el **orden**: el Usuario del Sistema tiene que estar dentro
del **mismo portafolio que es dueño de la cuenta de WhatsApp**. Si está en
otro, el botón "Agregar activos" ni siquiera te muestra la cuenta, y parece
que Meta está fallando cuando en realidad estás parado en el negocio
equivocado.

1. En Meta Business Settings, abre el **portafolio dueño** de la cuenta de WhatsApp.
2. **Usuarios del sistema** → agrégalo si no hay ninguno.
3. Selecciónalo → **Agregar activos** → pestaña **Cuentas de WhatsApp** →
   marca la cuenta → **Control total**.
4. Repite en la pestaña **Apps** con la app del asistente.
5. Genera un **token nuevo** (ya con los activos asignados), ponlo en
   `WHATSAPP_TOKEN_BASESBOX` en Vercel y **redespliega**.

> ⚠️ Un token generado ANTES de asignar los activos no sirve aunque asignes
> los activos después. Hay que generarlo de nuevo.

### Ojo con el celular que ya usan

El número **311 121 6033** hoy está en la app de WhatsApp Business del
celular. Al pasarlo a la API de Meta (que es lo que usa este asistente),
**deja de funcionar en esa app**: las conversaciones se atienden desde el
servidor o desde el Inbox de Meta. Si no quieren perder el celular, conecta
un número nuevo y desvía a ese los mensajes de la publicidad.

### Que te avise solo si se cae

`/salud` responde **503** cuando algo está roto. Apúntale un monitor gratuito
(UptimeRobot y similares) cada 15 minutos y te avisa por correo. Así no se
repite lo de agosto, que estuvo caído más de un día sin que nadie se enterara.

---

## 🔀 Cómo se asigna cada número a un negocio

Cada número de WhatsApp tiene un **Phone number ID** único en Meta. Pones ese
id en la variable del negocio correspondiente:

```
PHONE_ID_BASESBOX=123456789     -> los WhatsApp de ese número los atiende Bases Box
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
│   ├── app.js          ← recibe los WhatsApp de Meta y los atiende
│   ├── server.js       ← arranca el servidor (Render / tu compu)
│   ├── router.js       ← decide qué negocio atiende
│   ├── brain.js        ← redacta la respuesta (Gemini o Claude)
│   ├── whatsapp.js     ← envía la respuesta por WhatsApp
│   ├── adjuntos.js     ← qué contestar a audios, fotos y ubicaciones
│   ├── salud.js        ← /salud: dice si de verdad puede contestar
│   ├── memory.js       ← recuerda el hilo de cada conversación
│   ├── config.js       ← lee las variables de entorno
│   └── simulator.js    ← chat de prueba en la terminal
├── .env.example        ← plantilla de configuración
└── package.json
```

---

## 📝 Notas y siguientes pasos

- **Memoria:** hoy se guarda en la memoria del servidor y se borra tras 6 h de
  inactividad (o si reinicias). Para varios servidores/producción seria,
  conviene una base de datos o Redis. Para arrancar, así está bien.
- **Qué entiende:** lee texto, el pie de una foto y los botones que toque el
  cliente. Los audios, fotos, videos y ubicaciones **sí reciben respuesta**,
  pero una de aviso ("no puedo escucharlo, ¿me lo escribes?"), porque todavía
  no transcribe audio ni ve imágenes. A las reacciones (👍) no contesta, a
  propósito.
- **Mensajes repetidos:** si Meta reintenta la entrega, el asistente reconoce
  el mensaje y no contesta dos veces.
- **Costo:** Meta Cloud API es gratis hasta cierto volumen de conversaciones al
  mes. Con `AI_PROVIDER=gemini` el cerebro no cuesta nada (límite de
  peticiones por minuto). Si cambias a Claude, cobra por uso.
- **Privacidad:** nunca subas tu `.env` a git (ya está en `.gitignore`).
