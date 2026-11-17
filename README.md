# Nexo · Informes de máquinas

Una nueva aplicación para organizar máquinas, registrar novedades con evidencias y producir informes técnicos profesionales. Está construida con **Angular 20, Tailwind CSS y arquitectura limpia**, y puede publicarse como sitio estático. El proyecto anterior de Flask permanece en la raíz para facilitar la migración.

## Antes de empezar: dónde están tus datos

**La aplicación es estática y no tiene servidor de datos.** Usa SQLite real mediante SQL.js y guarda el archivo de la base en IndexedDB **en el navegador y el origen donde se utiliza**. Un despliegue en GitHub Pages permite acceder a la aplicación desde una URL, pero **no sincroniza datos entre navegadores, dispositivos o usuarios**. Tampoco proporciona autenticación ni acceso compartido.

Descarga respaldos regularmente desde **Mis datos**: borrar los datos del navegador, cambiar de dispositivo o usar otro dominio puede hacer que no veas la información anterior. Para un equipo multiusuario o sincronización se necesitaría un backend seguro adicional, que esta versión no incluye.

> **Privacidad del proyecto anterior:** `informes.db` y al menos una imagen de `static/uploads` ya estaban versionados en este repositorio antes de esta migración. `.gitignore` impide agregar nuevas bases y evidencias, pero **no elimina archivos ya rastreados ni su historial**. Revisa la visibilidad del repositorio y conserva una copia segura antes de retirar cualquier dato. El despliegue Angular solo publica `angular-app/dist/.../browser`, no la base anterior.

## Ejecutar en desarrollo

Requiere **Node.js 22.12 o superior** y npm.

```bash
cd angular-app
npm ci
npm start
```

Abre `http://localhost:4200`. El servidor de desarrollo escucha en todas las interfaces para facilitar las pruebas; úsalo solo en redes de confianza. Para una vista de producción:

```bash
npm run build
# Los archivos estáticos quedan en dist/nexo-informes/browser/
```

Para usar un servidor estático, sirve esa carpeta mediante HTTP/HTTPS; no abras `index.html` directamente con `file://` porque WebAssembly, IndexedDB y el portapapeles necesitan un contexto web adecuado.

### Con Docker Compose

Con Docker y el plugin Compose instalados, desde la raíz:

```bash
docker compose up --build -d
# Abrir http://localhost:8080
docker compose down
```

El contenedor solo sirve los archivos estáticos. **Los datos siguen guardándose en cada navegador**, no en un volumen del contenedor. Para acceso remoto utiliza HTTPS y un proxy seguro; no hay inicio de sesión incorporado.

## Guía rápida

1. En **Máquinas**, pulsa **Nueva máquina**. Agrega un nombre y, si deseas, una ubicación. Puedes editarla o eliminarla; al eliminarla también se eliminan sus informes y evidencias, después de pedir confirmación.
2. Pulsa **Nuevo informe**, selecciona la máquina, fecha y hora, y describe la novedad. La fecha y hora iniciales son las locales actuales y se pueden cambiar.
3. Para agregar evidencias, copia un recorte y pulsa **Ctrl + V** (o **⌘ + V** en Mac) mientras el formulario está abierto. También puedes arrastrar archivos, seleccionarlos o usar **Pegar imagen**. El botón de portapapeles requiere HTTPS o localhost y permiso del navegador; si no está disponible, usa el pegado por teclado o selecciona el archivo.
4. Consulta y edita los registros en **Informes**. Puedes buscar por texto, filtrar por máquina y por rango de fechas, y ampliar una evidencia.
5. En el panel principal o con **Descargar PDF**, escribe el título y responsable y elige **Este mes**, **Quincena**, **Todo** o fechas personalizadas. El intervalo incluye ambos extremos. El PDF agrupa cronológicamente por máquina e incorpora las evidencias; el documento se genera en el navegador.
6. En **Mis datos**, descarga un respaldo SQLite o revisa uno antes de restaurarlo. También puedes importar una base desde una URL HTTPS directa que permita CORS. **Restaurar reemplaza** los datos actuales después de mostrar un resumen y solicitar confirmación; no realiza sincronización. No publiques respaldos privados en URLs públicas.

Se admiten hasta **8 imágenes por informe**, de hasta **5 MB cada una** (PNG, JPG, WebP o GIF; los dos últimos se convierten a PNG y el GIF conserva su primer fotograma). Cada base puede ocupar hasta **100 MB**; se rechaza cualquier operación que supere ese límite sin sobrescribir los datos anteriores. El espacio efectivo también depende de la cuota del navegador.

## Migrar los datos de Flask

1. Conserva una copia del archivo original `informes.db` y de la carpeta `static/uploads/`.
2. Abre Nexo y entra en **Mis datos**. Descarga antes un respaldo de Nexo si ya tienes información que quieres conservar.
3. Selecciona `informes.db` como **Archivo de base de datos**. En **Imágenes del proyecto anterior**, selecciona los archivos de `static/uploads` que tengas disponibles.
4. Pulsa **Revisar archivo**. Se mostrarán las cantidades de máquinas, informes e imágenes, y los nombres de evidencias faltantes. El repositorio original puede contener referencias a imágenes que ya no están en la carpeta: recupéralas antes de confirmar si quieres incluirlas.
5. Confirma **Confirmar y reemplazar**. La migración crea una nueva base y no modifica la base original. Los informes cuyas imágenes no estén disponibles se importarán sin esas imágenes, previo aviso.

La versión Flask original y sus archivos se conservan; su documentación histórica está en [README_LEGACY.md](README_LEGACY.md).

## Publicar como sitio estático / GitHub Pages

El flujo [deploy-pages.yml](.github/workflows/deploy-pages.yml) compila Angular con el subdirectorio del repositorio, publica únicamente los archivos estáticos y se ejecuta al actualizar `main` o mediante ejecución manual. Las rutas usan `#`, por lo que una recarga funciona en GitHub Pages sin configuración adicional del servidor.

1. En GitHub, abre **Settings → Pages → Build and deployment** y selecciona **GitHub Actions** como origen.
2. Integra este flujo en la rama predeterminada. Tras un push a `main`, espera a que termine **Publicar en GitHub Pages** en la pestaña Actions. Para ejecutarlo manualmente desde otra rama, el archivo del flujo debe existir primero en la rama predeterminada; después elige esa rama en **Run workflow**.
3. GitHub mostrará la URL real del despliegue. Para este repositorio, la URL habitual sería `https://willianruiz-dev.github.io/INFORMES_QUISCOS/` **después** de activar Pages y completar correctamente el flujo.

Para otro proveedor estático, publica el contenido de `angular-app/dist/nexo-informes/browser`. Si se aloja en un subdirectorio, ajusta la base al compilar, por ejemplo:

```bash
cd angular-app
npm run build -- --base-href /INFORMES_QUISCOS/
```

Un dominio raíz o personalizado suele usar `--base-href /`. Cambiar de origen implica otro almacenamiento local del navegador: exporta y restaura una copia para trasladar tus datos.

## Pruebas y arquitectura

```bash
cd angular-app
npx playwright install chromium   # en Linux puede requerir: npx playwright install --with-deps chromium
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Las pruebas recorren creación y edición, pegado de imágenes, persistencia, PDF con fechas y evidencias, paginación, migración, respaldos, recuperación, concurrencia entre pestañas y despliegue en un subdirectorio. CI ejecuta la compilación y las pruebas con Chromium.

Consulta [angular-app/README.md](angular-app/README.md) para ver las capas, el esquema SQLite, los límites y las decisiones técnicas, y [docs/EVALUACION.md](docs/EVALUACION.md) para los resultados y limitaciones comprobadas. Cada componente mantiene su HTML, CSS y lógica TypeScript en archivos separados.
