# Planes de alimentación

Entregables en PDF para clientes que piden una sugerencia de dieta.

## Generar el PDF

```bash
pip install reportlab
python3 nutricion/generar_plan.py
```

El archivo se escribe en `nutricion/entregables/`.

## Hacer un plan para otra persona

Copia `generar_plan.py` y edita **solo** el bloque `PERFIL` y las listas de
contenido (`MENU`, `INTERCAMBIOS`, `NUTRIENTES`, `SUPER`, `RECETAS`). La edad,
el IMC, el rango de peso saludable y el gasto energético se recalculan solos a
partir de `PERFIL` — no hay números escritos a mano en el documento.

El diseño (portada, encabezados, tablas, cajas de aviso) es genérico y no hay
que tocarlo.

## Nota

Estos documentos son **orientativos**. Cada PDF lo dice en la portada, en el
pie de todas las páginas y en el recuadro final: no sustituyen la valoración
de un nutriólogo ni del médico tratante.
