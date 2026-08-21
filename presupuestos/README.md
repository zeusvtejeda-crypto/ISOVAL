# Presupuestos — LYM Villeda

PDF de propuesta económica para presentar a clientes: los tres planes de
gestión de redes, promociones vigentes, servicios adicionales, el método de
trabajo y las condiciones comerciales.

- **PDF listo:** `Presupuestos-Paquetes-LYM-Villeda.pdf`
- **Generador:** `generar_presupuestos.py`

## Precios vigentes

| Plan | Inversión mensual |
|---|---|
| Esencial | $4,900 MXN / mes |
| Crecimiento *(recomendado)* | $7,900 MXN / mes |
| Completo | $14,900 MXN / mes |

Escalón nuevo, con el piso arriba de $4,000. Referencias anteriores, ya sin
efecto: Esencial $2,900 → $3,900 · Crecimiento $6,900 · Completo $12,900, y
antes de eso Essential $1,500 · Impulse $3,000 · Pro $5,000.

El Completo trae $2,000 de pauta adentro, así que en servicio puro sigue
valiendo $12,900 — lo mismo que costaba antes.

Los servicios adicionales —sitio web, identidad, campañas, video, asistente de
WhatsApp con IA, email marketing, menú QR, gestión bilingüe— van sin precio
fijo: se cotizan según el alcance de cada proyecto.

## Cómo cambiar precios o textos

Todo lo editable está en el bloque `CONFIGURACIÓN`, hasta arriba del script:

| Qué | Dónde |
|---|---|
| Marca, ciudad, teléfono, correo y redes | `MARCA`, `CIUDAD`, `TELEFONO`, `CORREO`, `REDES` |
| Precio y contenido de cada plan | lista `PLANES` |
| Cuál lleva el sello "recomendado" | `destacado: True` dentro del plan |
| Tabla comparativa de la portada | `COMPARATIVA` |
| Promociones | `PROMOCIONES` |
| Servicios adicionales | `ADICIONALES` |
| Método de trabajo | `PROCESO` |
| Condiciones comerciales | `CONDICIONES` |
| Portafolio citado en la portada | `PORTAFOLIO` |
| Vigencia de la cotización | `VIGENCIA` |
| Mostrar la nota de IVA | `MOSTRAR_IVA` (hoy en `False`) |

La fecha se pone sola con el día en que se genera el PDF.

Después de editar:

```bash
pip install reportlab
python3 generar_presupuestos.py
```

El PDF se regenera en esta misma carpeta.
