# Evaluación de la migración

Fecha: 17 de noviembre de 2026. Se verificó la aplicación compilada como sitio estático con Node.js 22 y Chromium.

## Resultados

- `npm run build`: compilación de producción correcta.
- `npm run test:e2e`: **8 pruebas de navegador aprobadas**. Cubren creación, edición y eliminación; pegado y validación de imágenes; fechas inclusivas; PDF con imágenes, texto y paginación; persistencia tras recarga; respaldo y restauración; migración; recuperación ante datos dañados; uso simultáneo desde dos pestañas y pantalla móvil.
- Compilación con `--base-href /INFORMES_QUISCOS/`: correcta; dos pruebas adicionales del flujo y pantalla móvil pasaron sirviendo la aplicación desde ese subdirectorio.
- Migración manual de la base anterior incluida en esta copia: **7 máquinas, 13 informes y 1 imagen disponible**. La aplicación advirtió que faltaban **11 archivos de evidencia** referenciados por esa base. El PDF consolidado de esa migración se generó correctamente en 4 páginas con la imagen disponible. Las imágenes que no existan no pueden recuperarse desde SQLite: hay que encontrarlas en una copia anterior de `static/uploads` antes de importar si se desean conservar.
- `npm audit --omit=dev --audit-level=high`: sin vulnerabilidades reportadas en dependencias de producción. Una auditoría completa reportó **16 moderadas** en dependencias transitivas de desarrollo de Angular CLI (`glob`/`minimatch`); no se forzó una actualización incompatible. Conviene revisarlas al actualizar la cadena de compilación.

## Pendiente de la infraestructura de destino

- Docker/Compose está configurado, pero no se pudo ejecutar en este entorno porque Docker no estaba instalado.
- GitHub Pages debe activarse en la configuración del repositorio y el flujo debe completarse en GitHub para disponer de una URL publicada. La prueba local del subdirectorio no equivale a un despliegue remoto.
- La versión estática no sincroniza ni comparte información entre usuarios: esa capacidad requiere un backend y medidas de seguridad adicionales.
