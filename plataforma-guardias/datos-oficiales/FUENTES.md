# Instalaciones de salud de Nayarit — fuentes oficiales

Catálogo de instalaciones para `plataforma-guardias`, construido solo con fuentes oficiales y reproducible con `construir_instalaciones.py`.

## Archivos

| Archivo | Qué es |
|---|---|
| `instalaciones_nayarit.csv` | **Resultado.** 646 establecimientos de Nayarit *en operación*, todas las instituciones, con CLUES, municipio INEGI, dirección, coordenadas, `fuente` y `validacion`. |
| `fuentes/clues_nayarit_202608_completo.csv` | Extracto íntegro de CLUES para Nayarit (1,149 filas: 646 en operación, 502 fuera de operación, 1 pendiente), 68 columnas originales. |
| `fuentes/imss_directorio_nayarit_2026-10-17.csv` | Directorio público de instalaciones IMSS en Nayarit (135 entradas: 42 clínicas, 11 hospitales, 82 IMSS-Bienestar), extraído de imss.gob.mx. |
| `imss_directorio_sin_clues.csv` | Unidades del directorio IMSS sin equivalente en CLUES. Hoy: 0. |
| `construir_instalaciones.py` | Genera el resultado a partir de las dos fuentes. Sin dependencias externas. |

## Fuentes

### 1. CLUES — Secretaría de Salud / DGIS (fuente principal)
- Página: http://www.dgis.salud.gob.mx/contenidos/intercambio/clues_gobmx.html
- Archivo: `ESTABLECIMIENTO_SALUD_202608.xlsx` (publicado 2026-09-23), hoja `CLUES_202608`. 64,450 establecimientos nacionales.
- Filtro aplicado: `CLAVE DE LA ENTIDAD = 18` (Nayarit).
- Aporta: clave CLUES, institución, tipología, nivel de atención, municipio (clave INEGI de 3 dígitos → `18XXX`), localidad, domicilio, CP, teléfono, lat/lng, estatus.
- Las otras hojas (`SUBCLUES`, `HORARIOS`) no se usaron.

### 2. Directorio de instalaciones IMSS (validación cruzada)
- https://www.imss.gob.mx/directorio?dom_estado=Nayarit&catalogada_como=Clínica|Hospital|IMSS%20Bienestar
- Solo HTML paginado con botón «Descargar PDF»; no ofrece CSV. Se extrajeron nombre, tipo, dirección, horario y la coordenada del enlace a Google Maps.
- El directorio repite unidades (una entrada por servicio: unidad médica, puesto de vacunación) y a veces con coordenadas distintas entre sí.

### 3. datos.gob.mx (revisado; no aporta Nayarit)
- API: `https://www.datos.gob.mx/api/3/action/package_search?q=...` (el dominio sin `www` y la ruta antigua `/busca/` devuelven 403/404).
- Búsquedas: `imss`, `unidades medicas`, `clues`, `establecimientos de salud`, `nayarit salud`.
- Único dataset de directorio: **«Directorio de Unidades Médicas de IMSS-BIENESTAR»** (`/dataset/directorio_unidades_medicas_imss_bienestar`, actualizado 2026-04-02). Solo publica Campeche, CDMX y Chiapas (1er trim. 2025); el archivo de Nayarit no existe (403).
- El IMSS ordinario no publica directorio de unidades en datos.gob.mx (sus datasets son quejas, CNDH, detección de padecimientos).
- `datos.imss.gob.mx` respondía 503 el 2026-10-17.

## Validación realizada

| Comprobación | Resultado |
|---|---|
| Coordenadas vacías en CLUES (en operación) | 0 |
| Unidades IMSS/IMSS-Bienestar con entrada en el directorio IMSS | 116 de 396 |
| · coinciden (≤ 1 km) | 108 |
| · coordenada CLUES dudosa, se tomó la del directorio IMSS | 7 (UMF 5, 20, 24, 25 Tepic; UMF 19 Mezcales; Linda Vista ×2) |
| · discrepancia sin resolver, se conserva CLUES | 1 (UMAA 28 Tepic, 5 km) |
| Unidades del directorio IMSS que no están en CLUES | 0 |
| Coordenadas CLUES fuera del área del municipio (`revisar`) | 16; incluye 3 Farmacias Similares con coordenadas en Tamaulipas |

Reglas del script:
- Solo `ESTATUS DE OPERACION = EN OPERACION`.
- La coordenada CLUES se sustituye por la del directorio IMSS **únicamente** cuando la de CLUES es dudosa (compartida por 3+ unidades o fuera del área del municipio) y la del IMSS cae dentro del municipio. Siempre queda registrado en `validacion` con la coordenada original.
- Nombres repetidos en CLUES (p. ej. «La Presa») solo se emparejan con el directorio si hay coincidencia a ≤ 1 km.

## Columnas de `instalaciones_nayarit.csv`

`clues, nombre, nombre_corto, clave_institucion, institucion, tipo_establecimiento, tipologia, nivel_atencion, cve_municipio (INEGI 18XXX), municipio, localidad, direccion, codigo_postal, telefono, lat, lng, estatus, fuente, fuente_fecha, validacion`

Instituciones (`clave_institucion`): IMB IMSS-Bienestar 273 · SMP privados 158 · IMS IMSS 123 · SSA 29 · IST ISSSTE 23 · DIF 20 · CRO Cruz Roja 6 · otras 14.

> Nota: la plantilla `public/plantillas/instalaciones.csv` de la rama `claude/plataforma-guardias` no estaba publicada al generar este archivo. Si sus columnas difieren, ajustar el diccionario `salida.append({...})` en el script; todos los campos de origen están en `fuentes/`.

## Pendientes
- Decidir qué instituciones carga la plataforma (p. ej. solo IMS/IMB, o también SSA/ISSSTE).
- Revisar manualmente las 16 filas marcadas «revisar» y la UMAA 28 Tepic.
- Reejecutar al salir una nueva versión mensual de CLUES (cambiar `CLUES_VERSION` y reemplazar el extracto en `fuentes/`).
