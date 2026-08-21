# Presupuestos — paquetes de servicios digitales

PDF de propuesta económica para presentar a clientes: tres paquetes cerrados,
servicios sueltos, mensualidades, costos de terceros y condiciones comerciales.

- **PDF listo:** `Presupuestos-Paquetes-Servicios-Digitales.pdf`
- **Generador:** `generar_presupuestos.py`

## Cómo cambiar precios o textos

Todo lo editable está en el bloque `CONFIGURACIÓN`, hasta arriba del script:

| Qué | Dónde |
|---|---|
| Nombre del estudio, ciudad y datos de contacto | `ESTUDIO`, `CIUDAD`, `CONTACTO` |
| Precio y mensualidad de cada paquete | lista `PAQUETES` |
| Qué incluye y qué recibe el cliente | `incluye` y `entregables` dentro de cada paquete |
| Tabla comparativa de la portada | `COMPARATIVA` |
| Servicios a la carta | `SERVICIOS` |
| Mensualidades | `MENSUALIDADES` |
| Costos de terceros | `TERCEROS` |
| Condiciones y siguiente paso | `CONDICIONES`, `SIGUIENTE_PASO` |
| Vigencia de la cotización | `VIGENCIA` |

La fecha se pone sola con el día en que se genera el PDF.

Después de editar:

```bash
pip install reportlab
python3 generar_presupuestos.py
```

El PDF se regenera en esta misma carpeta.

## Nota sobre los precios

Los montos son una **propuesta de referencia** para el mercado de Tepic,
Nayarit, calculada así: cada paquete cuesta menos que la suma de sus partes
por separado (el ahorro va impreso debajo de cada tarjeta). Ajústalos a tus
costos reales antes de mandar el PDF a un cliente.

Los tres paquetes salen del trabajo que ya está en este repo: sitio
multi-sección (Isoval), sitio + identidad + calendario de contenido
(Bases Box Tepic) y el asistente de WhatsApp multi-negocio.
