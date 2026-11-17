import { test, expect, Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import initSqlJs from 'sql.js';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = '/INFORMES_QUISCOS/';
const evidencePath = 'tests/fixtures/evidencia.png';

async function createMachine(page: Page, name: string, location = ''): Promise<void> {
  await page.getByRole('link', { name: 'Máquinas', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva máquina', exact: true }).click();
  await page.locator('#machine-name').fill(name);
  if (location) await page.locator('#machine-location').fill(location);
  await page.getByRole('dialog').getByRole('button', { name: 'Crear máquina', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva máquina' })).toHaveCount(0);
}

async function openReport(page: Page, machine: string, date: string, description: string): Promise<void> {
  await page.locator('.top-new').click();
  await page.locator('#report-machine').selectOption({ label: machine });
  await page.locator('#report-date').fill(date);
  await page.locator('#report-time').fill('09:45');
  await page.locator('#report-description').fill(description);
}

async function pasteImage(page: Page): Promise<void> {
  const base64 = (await readFile(evidencePath)).toString('base64');
  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([bytes], 'recorte.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true }));
  }, base64);
  await expect(page.locator('.evidence-preview')).toHaveCount(1);
}

async function pdfContent(bytes: Buffer): Promise<{ text: string; pages: number; images: number }> {
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true }).promise;
  let text = ''; let images = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => 'str' in item ? item.str : '').join(' ');
    const operators = await page.getOperatorList();
    images += operators.fnArray.filter((operation) => operation === OPS.paintImageXObject || operation === OPS.paintInlineImageXObject).length;
  }
  const pages = pdf.numPages;
  await pdf.destroy();
  return { text, pages, images };
}

test('flujo completo: máquina, portapapeles, edición, fechas, PDF y persistencia', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(root);
  await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo.' })).toBeVisible();
  await createMachine(page, 'SuSuerte - Cable Aéreo', 'Medellín');
  await expect(page.getByText('Medellín', { exact: true })).toBeVisible();

  // Name validation remains inside the transaction and is case insensitive.
  await page.getByRole('button', { name: 'Nueva máquina', exact: true }).click();
  await page.locator('#machine-name').fill('susuerte - cable aéreo');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear máquina', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ya existe una máquina');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();

  await openReport(page, 'SuSuerte - Cable Aéreo', '2025-10-10', 'Se revisó el monedero y quedó funcionando.');
  await pasteImage(page);
  await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openReport(page, 'SuSuerte - Cable Aéreo', '2025-11-21', 'Esta novedad está fuera del período.');
  await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.locator('.report-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.report-card')).toHaveCount(2);
  await expect(page.getByText('Se revisó el monedero y quedó funcionando.')).toBeVisible();
  await expect(page.locator('.evidence-list img')).toHaveCount(1);

  await page.locator('#filter-start').fill('2025-10-01');
  await page.locator('#filter-end').fill('2025-10-15');
  await expect(page.locator('.report-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await page.locator('#pdf-title-modal').fill('Informe técnico quincenal');
  await page.locator('#pdf-tech-modal').fill('Willian Ruiz Z');
  await page.locator('#pdf-start-modal').fill('2025-10-01');
  await page.locator('#pdf-end-modal').fill('2025-10-15');
  await expect(page.getByRole('dialog').getByText('1 novedad incluida')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('dialog').getByRole('button', { name: 'Descargar informe PDF' }).click()
  ]);
  const buffer = await readFile(await download.path() as string);
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  const pdf = await pdfContent(buffer);
  expect(pdf.text).toContain('Informe técnico quincenal');
  expect(pdf.text).toContain('Willian Ruiz Z');
  expect(pdf.text).toContain('SuSuerte - Cable Aéreo');
  expect(pdf.text).toContain('Se revisó el monedero');
  expect(pdf.text).not.toContain('fuera del período');
  expect(pdf.images).toBeGreaterThan(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Editar informe 1' }).click();
  await expect(page.locator('.evidence-preview')).toHaveCount(1);
  await page.locator('#report-description').fill('Novedad editada y verificada.');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Novedad editada y verificada.')).toBeVisible();
  await expect(page.locator('.evidence-list img')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('respalda SQLite, advierte antes de reemplazar y restaura desde archivo y URL', async ({ page }) => {
  await page.goto(root);
  await createMachine(page, 'Máquina de respaldo');
  await openReport(page, 'Máquina de respaldo', '2025-10-12', 'Registro que debe sobrevivir.');
  await pasteImage(page);
  await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar respaldo SQLite' }).click()]);
  const bytes = await readFile(await backup.path() as string);
  expect(bytes.subarray(0, 16).toString()).toBe('SQLite format 3\0');
  const SQL = await initSqlJs();
  const db = new SQL.Database(bytes);
  expect(db.exec('SELECT count(*) FROM machines')[0].values[0][0]).toBe(1);
  expect(db.exec('SELECT count(*) FROM evidence')[0].values[0][0]).toBe(1);
  db.close();

  await page.getByRole('link', { name: 'Máquinas', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Eliminar máquina Máquina de respaldo' }).click();
  await expect(page.getByText('Comienza por tu primera máquina')).toBeVisible();
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.getByText('Aún no hay informes')).toBeVisible();
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  await page.locator('#backup-file').setInputFiles({ name: 'respaldo.sqlite', mimeType: 'application/octet-stream', buffer: bytes });
  await page.getByRole('button', { name: 'Revisar archivo' }).click();
  await expect(page.getByText('Archivo listo para importar')).toBeVisible();
  await expect(page.locator('.preview-counts')).toContainText('1 máquinas');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirmar y reemplazar' }).click();
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.getByText('Registro que debe sobrevivir.')).toBeVisible();
  await expect(page.locator('.evidence-list img')).toHaveCount(1);

  // Remote import accepts a direct same-origin URL, with no automatic sync.
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  await page.route('**/remote.sqlite', (route) => route.fulfill({ status: 200, contentType: 'application/vnd.sqlite3', body: bytes }));
  await page.getByLabel('URL de la base SQLite').fill('http://127.0.0.1:4173/INFORMES_QUISCOS/remote.sqlite');
  await page.getByRole('button', { name: 'Revisar URL' }).click();
  await expect(page.getByText('Archivo listo para importar')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirmar y reemplazar' }).click();
  await page.reload();
  await expect(page.locator('.backup-stats')).toContainText('Máquinas');
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.getByText('Registro que debe sobrevivir.')).toBeVisible();

  // Invalid files never replace the current database.
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  await page.locator('#backup-file').setInputFiles({ name: 'roto.db', mimeType: 'application/octet-stream', buffer: Buffer.from('not sqlite') });
  await page.getByRole('button', { name: 'Revisar archivo' }).click();
  await expect(page.getByRole('alert')).toContainText('no es una base SQLite válida');
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.getByText('Registro que debe sobrevivir.')).toBeVisible();
});

test('migra la base Flask e informa imágenes ausentes antes de confirmar', async ({ page }, testInfo) => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE maquinas (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);
    CREATE TABLE informes (id INTEGER PRIMARY KEY, nombre_maquina TEXT, fecha TEXT, hora TEXT, descripcion TEXT, imagen TEXT, creado_en TEXT);
    INSERT INTO maquinas VALUES (1, 'Equipo antiguo');
    INSERT INTO informes VALUES (1, 'Equipo antiguo', '2025-10-15', '07:30', 'Informe histórico con captura.', 'evidencia.png', '2025-10-15 08:00:00');
    INSERT INTO informes VALUES (2, 'Equipo antiguo', '2025-10-16', '12:00', 'Informe sin archivo.', 'ausente.png', '2025-10-16 12:00:00');`);
  const fixture = testInfo.outputPath('legacy.db');
  await writeFile(fixture, db.export()); db.close();
  await page.goto(`${root}#/datos`);
  await page.locator('#backup-file').setInputFiles(fixture);
  await page.locator('#legacy-images').setInputFiles(evidencePath);
  await page.getByRole('button', { name: 'Revisar archivo' }).click();
  await expect(page.getByText('Base del proyecto anterior', { exact: false })).toBeVisible();
  await expect(page.getByText('Faltan 1 archivo(s) de evidencia')).toBeVisible();
  await expect(page.locator('.preview-counts')).toContainText('2 informes');
  await expect(page.locator('.preview-counts')).toContainText('1 evidencias');
  let warning = '';
  page.once('dialog', (dialog) => { warning = dialog.message(); return dialog.accept(); });
  await page.getByRole('button', { name: 'Confirmar y reemplazar' }).click();
  expect(warning).toContain('Faltan 1 archivo');
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.locator('.report-card')).toHaveCount(2);
  await expect(page.locator('.evidence-list img')).toHaveCount(1);
  await expect(page.getByText('Informe histórico con captura.')).toBeVisible();
});

test('varias pestañas guardan sin sobrescribir cambios y se actualizan', async ({ context, page }) => {
  await page.goto(root);
  const second = await context.newPage();
  await second.goto(root);
  await Promise.all([
    createMachine(page, 'Equipo pestaña uno'),
    createMachine(second, 'Equipo pestaña dos')
  ]);
  await expect(page.getByText('Equipo pestaña uno', { exact: true })).toBeVisible();
  await expect(page.getByText('Equipo pestaña dos', { exact: true })).toBeVisible();
  await expect(second.getByText('Equipo pestaña uno', { exact: true })).toBeVisible();
  await expect(second.getByText('Equipo pestaña dos', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.machine-card')).toHaveCount(2);
  await second.close();
});

test('pantalla pequeña y períodos quincenales funcionan en subdirectorio estático', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2024-02-20T12:00:00'));
  await page.goto(root);
  await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo.' })).toBeVisible();
  await page.getByRole('button', { name: 'Quincena', exact: true }).click();
  await expect(page.locator('#pdf-start')).toHaveValue('2024-02-16');
  await expect(page.locator('#pdf-end')).toHaveValue('2024-02-29');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Máquinas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis máquinas.' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('PDF largo pagina sin perder texto, agrupa máquinas y respeta fechas inclusivas', async ({ page }) => {
  await page.goto(root);
  await createMachine(page, 'Equipo Alfa');
  await createMachine(page, 'Equipo Beta');
  const longText = Array.from({ length: 60 }, (_, i) => `Línea ${i + 1}: Se revisaron conexiones, monederos y sensores de la máquina.`).join('\n');
  await openReport(page, 'Equipo Alfa', '2025-10-01', longText);
  await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openReport(page, 'Equipo Beta', '2025-10-15', 'Fin del período incluido.');
  await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  await page.locator('#pdf-start-modal').fill('2025-10-01');
  await page.locator('#pdf-end-modal').fill('2025-10-15');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('dialog').getByRole('button', { name: 'Descargar informe PDF' }).click()
  ]);
  const pdf = await pdfContent(await readFile(await download.path() as string));
  expect(pdf.pages).toBeGreaterThan(1);
  expect(pdf.text).toContain('Equipo Alfa');
  expect(pdf.text).toContain('Equipo Beta');
  expect(pdf.text).toContain('Línea 1:');
  expect(pdf.text).toContain('Línea 60:');
  expect(pdf.text).toContain('Fin del período incluido.');
});

test('rechaza imágenes inválidas sin perder el formulario y permite reemplazar evidencias', async ({ page }) => {
  await page.goto(root);
  await createMachine(page, 'Equipo de prueba');
  await openReport(page, 'Equipo de prueba', '2025-10-12', 'Prueba de imágenes.');
  await page.locator('#evidence-files').setInputFiles({ name: 'imagen-rota.png', mimeType: 'image/png', buffer: Buffer.from('no es una imagen') });
  await expect(page.getByRole('alert')).toContainText('no es una imagen válida');
  await expect(page.locator('.evidence-preview')).toHaveCount(0);
  await page.locator('#evidence-files').setInputFiles(evidencePath);
  await expect(page.locator('.evidence-preview')).toHaveCount(1);
  await page.getByRole('button', { name: 'Quitar evidencia evidencia.png' }).click();
  await expect(page.locator('.evidence-preview')).toHaveCount(0);
  await pasteImage(page);
  await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Informes', exact: true }).click();
  await expect(page.locator('.evidence-list img')).toHaveCount(1);
});

test('permite recuperar una base local dañada a partir de un respaldo', async ({ page }) => {
  await page.goto(root);
  await createMachine(page, 'Equipo recuperable');
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar respaldo SQLite' }).click()]);
  const bytes = await readFile(await backup.path() as string);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nexo-informes', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sqlite', 'readwrite');
      tx.objectStore('sqlite').put(new Uint8Array([1, 2, 3]), 'main');
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto(root);
  await expect(page.getByRole('heading', { name: 'No pudimos abrir tus datos' })).toBeVisible();
  await page.getByRole('link', { name: 'Restaurar una copia' }).click();
  await expect(page.getByRole('heading', { name: 'Mis datos.' })).toBeVisible();
  await page.locator('#backup-file').setInputFiles({ name: 'copia.sqlite', mimeType: 'application/octet-stream', buffer: bytes });
  await page.getByRole('button', { name: 'Revisar archivo' }).click();
  await expect(page.getByText('Archivo listo para importar')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirmar y reemplazar' }).click();
  await expect(page.getByText('Base de datos restaurada correctamente.')).toBeVisible();
  await page.getByRole('link', { name: 'Máquinas', exact: true }).click();
  await expect(page.getByText('Equipo recuperable', { exact: true })).toBeVisible();
});
