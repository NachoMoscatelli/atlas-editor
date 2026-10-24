# Historial de versiones

## 0.6.1 — Tierra continua y contexto sin región

- Separa encuadre, geografía y asignación regional: el borde puede cortar tierra.
- Elimina la franja de agua obligatoria; separación inicial entre 0 y 20 %.
- Prolongación de una masa a cualquier lado, conservando la costa interior y las islas.
- Arrastre hasta el encuadre y creación opcional de regiones por masa.
- Quitar asignaciones en selección múltiple, conservando geografía y nombres.
- 135 pruebas y comprobación visual de edición y Deshacer.
- Pendiente: franjas numéricas por región, ríos/montañas divisores y dibujo libre.

## 0.6.0 — Geografía antes de territorios

- Propuestas reproducibles de continente e islas, con margen de agua.
- Editor visual de masas y vértices de costa, nombres y puntos adicionales.
- Cantidad de territorios por masa, vista previa y aplicación reversible.
- Océano como fondo, fuera de la malla territorial; costas compartidas coherentes.
- Archivo v4, compatibilidad con v1/v2/v3 y exportación SVG costera.
- 127 pruebas; verificación de vista previa, aplicar y deshacer en navegador.
- Primera etapa: sin lagos interiores, dibujo libre ni multipolígonos.

## 0.5.3 — Base inicial del repositorio

Esta versión reúne el desarrollo previo del editor. El historial de Git comienza
con este estado; las versiones anteriores se conservan como archivos ZIP fuera
del repositorio, sin reconstruir commits históricos.

- Generación procedural con semilla, irregularidad y tamaño físico configurable.
- Edición de fronteras compartidas, nodos y nombres.
- Selección múltiple y por lazo con intersección de territorios.
- Unión de territorios y subdivisión manual o automática con región compartida.
- Administrador de regiones y colores comunes.
- Guardado/carga JSON y exportación SVG, con vista Solo áreas.
- 113 pruebas del motor, archivos, regiones y exportación.
