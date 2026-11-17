# Nexo: guía técnica

Consulta el [README principal](../README.md) para instalación, uso, migración y despliegue.

## Arquitectura

```text
src/app/
├── core/
│   ├── domain/           # entidades, validación de fechas y contratos sin Angular
│   └── application/      # casos de uso, fachada reactiva, estado UI y tokens DI
├── infrastructure/       # SQLite/SQL.js, IndexedDB, lectura de imágenes y PDF
├── presentation/         # páginas, formularios, diseño y panel de exportación
└── shared/               # comportamiento compartido (foco de diálogos)
```

La presentación llama a casos de uso/fachada; los contratos (`ReportRepository`, `EvidenceReader`, `PdfExporter`) separan la lógica de las implementaciones. `app.config.ts` conecta los adaptadores mediante inyección de dependencias. Cada componente tiene archivos `.ts`, `.html` y `.css` independientes; Tailwind aporta utilidades y estilos comunes.

## Persistencia y seguridad de datos

- SQL.js ejecuta SQLite compilado a WebAssembly dentro del navegador. El archivo binario SQLite se almacena en IndexedDB (`nexo-informes`, almacén `sqlite`, clave `main`). No se envía a ningún servidor.
- Cada cambio abre la versión más reciente dentro de una transacción `readwrite` de IndexedDB, ejecuta una transacción SQLite y reemplaza el archivo solo al completarse. IndexedDB serializa los escritores de diferentes pestañas; `BroadcastChannel` solicita una actualización en las demás pestañas. Un fallo de cuota o validación no debe notificar éxito ni reemplazar el respaldo anterior.
- El esquema versión 1 contiene `machines`, `reports` y `evidence`, con claves foráneas y borrado en cascada. Las imágenes se guardan como datos PNG/JPEG en la propia base, de modo que el respaldo es autocontenido. Los datos SQL se insertan con parámetros.
- Antes de restaurar se comprueba la cabecera, integridad y estructura de SQLite y se reconstruye una base nueva con el esquema esperado y datos validados. Nunca se ejecuta el esquema importado como instrucciones de aplicación. La importación de Flask convierte las tablas `maquinas`/`informes`, agrupa nombres equivalentes y añade los archivos de evidencia seleccionados por nombre; si faltan, muestra un aviso previo. Una hora anterior inválida se interpreta como `00:00`; una fecha o descripción inválida detiene la importación.
- El límite de **100 MB** se aplica a la base persistida y a la importación, de forma que un respaldo creado aquí también pueda restaurarse. Se admiten 8 imágenes por informe, de hasta 5 MB cada una; GIF y WebP se normalizan a PNG. El navegador puede imponer cuotas menores.
- El almacenamiento es local por origen y puede ser eliminado por el usuario o el navegador. No es una base central, no sincroniza dispositivos y no implementa autenticación, cifrado, colaboración ni control de acceso. Usa respaldos y un equipo confiable; para colaboración se necesita otra infraestructura.
- Una URL de importación debe ser HTTPS o del mismo origen, devolver directamente un archivo SQLite y permitir CORS. La información alojada públicamente puede ser leída por terceros. La importación es explícita y reemplaza, no mezcla ni sincroniza.

## PDF

`ExportReportService` valida el período y selecciona los registros, incluyendo ambos límites. `PdfService` carga jsPDF bajo demanda y genera el documento localmente, agrupando por máquina y ordenando por fecha y hora. Incluye título, responsable, resumen, descripciones completas, evidencias proporcionadas, salto de página y pie numerado. Las fuentes DejaVu incluidas permiten mostrar correctamente texto en español; su licencia está en `src/assets/fonts/`.

## Comandos

```bash
npm ci
npm start                     # desarrollo en http://localhost:4200
npm run build                 # compilación de producción
npx playwright install chromium
npm run test:e2e              # compila y ejecuta las pruebas de navegador
```

El servidor de pruebas simula el subdirectorio `/INFORMES_QUISCOS/`. Si ya dispones de un Chromium compatible, puedes especificar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` al ejecutar Playwright. El flujo `ci.yml` ejecuta la auditoría de dependencias de producción y las pruebas; `deploy-pages.yml` publica el resultado tras configurar Pages.
