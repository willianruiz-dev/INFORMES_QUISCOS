import { Injectable, inject } from '@angular/core';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';

declare const initSqlJs: typeof import('sql.js');
import { validDate, validTime } from '../core/domain/dates';
import { Evidence, Machine, MachineInput, PreparedImport, Report, ReportInput, Snapshot } from '../core/domain/models';
import { ReportRepository } from '../core/domain/repository';
import { MAX_DATABASE_BYTES, MAX_EVIDENCE } from '../core/domain/ports';
import { IndexedDbStorage } from './indexed-db-storage';
import { readEvidence } from './image-codec';

type Row = Record<string, SqlValue>;

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    location TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data_url TEXT NOT NULL
  );
  CREATE INDEX reports_machine_date ON reports(machine_id, date, time);
  CREATE INDEX evidence_report ON evidence(report_id);
  PRAGMA user_version = 1;
`;

function rows(db: Database, sql: string, params: SqlValue[] = []): Row[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const result: Row[] = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally { statement.free(); }
}
function text(value: SqlValue | undefined): string { return typeof value === 'string' ? value : ''; }
function number(value: SqlValue | undefined): number { return typeof value === 'number' ? value : 0; }
function key(value: string): string { return value.normalize('NFKC').trim().toLocaleLowerCase('es'); }
function requireId(id: number): void {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('El identificador no es válido.');
}
function validateMachine(input: MachineInput): MachineInput {
  const name = input.name.normalize('NFKC').trim();
  const location = input.location.trim();
  if (!name || name.length > 120) throw new Error('El nombre de la máquina debe tener entre 1 y 120 caracteres.');
  if (location.length > 150) throw new Error('La ubicación no puede superar 150 caracteres.');
  return { name, location };
}
function validateEvidence(evidence: Evidence): void {
  const prefix = `data:${evidence.mimeType};base64,`;
  if (!['image/png', 'image/jpeg'].includes(evidence.mimeType) || !evidence.dataUrl.startsWith(prefix) ||
      evidence.dataUrl.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(evidence.dataUrl.slice(prefix.length))) {
    throw new Error('Una evidencia no tiene un formato de imagen válido.');
  }
  if (!evidence.name.trim() || evidence.name.length > 255) throw new Error('El nombre de una evidencia no es válido.');
}
function validateReport(input: ReportInput): ReportInput {
  requireId(input.machineId);
  if (!validDate(input.date) || !validTime(input.time)) throw new Error('Selecciona una fecha y una hora válidas.');
  const description = input.description.trim();
  if (!description || description.length > 50_000) throw new Error('La descripción debe tener entre 1 y 50.000 caracteres.');
  if (input.evidence.length > MAX_EVIDENCE) throw new Error(`Puedes agregar hasta ${MAX_EVIDENCE} imágenes por informe.`);
  input.evidence.forEach(validateEvidence);
  return { ...input, description };
}
function tableNames(db: Database): Set<string> {
  return new Set(rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => text(row['name'])));
}
function lastId(db: Database): number { return number(rows(db, 'SELECT last_insert_rowid() AS id')[0]?.['id']); }
function now(): string { return new Date().toISOString(); }

@Injectable({ providedIn: 'root' })
export class SqliteReportRepository implements ReportRepository {
  private readonly storage = inject(IndexedDbStorage);
  private sqlPromise?: Promise<SqlJsStatic>;

  private sql(): Promise<SqlJsStatic> {
    if (!this.sqlPromise) {
      this.sqlPromise = initSqlJs({ locateFile: () => new URL('assets/sql-wasm.wasm', document.baseURI).toString() });
    }
    return this.sqlPromise;
  }

  async initialize(): Promise<void> {
    const sql = await this.sql();
    await this.storage.modify((bytes) => {
      const db = new sql.Database(bytes);
      try {
        if (!bytes) db.run(SCHEMA);
        else this.assertCurrentSchema(db);
        return { bytes: db.export(), result: undefined };
      } finally { db.close(); }
    });
  }

  onExternalChange(listener: () => void): () => void { return this.storage.onExternalChange(listener); }

  private assertCurrentSchema(db: Database): void {
    const tables = tableNames(db);
    const version = number(rows(db, 'PRAGMA user_version')[0]?.['user_version']);
    if (version !== 1 || !['machines', 'reports', 'evidence'].every((table) => tables.has(table))) {
      throw new Error('La base local no tiene una estructura compatible. Restaura una copia válida.');
    }
  }

  private async read<T>(fn: (db: Database) => T): Promise<T> {
    const sql = await this.sql();
    const bytes = await this.storage.read();
    if (!bytes) throw new Error('La base de datos todavía no está disponible.');
    const db = new sql.Database(bytes);
    try { return fn(db); } finally { db.close(); }
  }

  private async write<T>(fn: (db: Database) => T): Promise<T> {
    const sql = await this.sql();
    return this.storage.modify((bytes) => {
      if (!bytes) throw new Error('La base de datos todavía no está disponible.');
      const db = new sql.Database(bytes);
      try {
        db.run('PRAGMA foreign_keys = ON');
        db.run('BEGIN TRANSACTION');
        const result = fn(db);
        db.run('COMMIT');
        return { bytes: db.export(), result };
      } finally { db.close(); }
    });
  }

  async snapshot(): Promise<Snapshot> {
    return this.read((db) => {
      const machines: Machine[] = rows(db, 'SELECT * FROM machines ORDER BY name COLLATE NOCASE').map((row) => ({
        id: number(row['id']), name: text(row['name']), location: text(row['location']), createdAt: text(row['created_at'])
      }));
      const evidenceByReport = new Map<number, Evidence[]>();
      for (const row of rows(db, 'SELECT * FROM evidence ORDER BY id')) {
        const id = number(row['report_id']);
        const evidence: Evidence = { id: number(row['id']), name: text(row['name']), mimeType: text(row['mime_type']) as Evidence['mimeType'], dataUrl: text(row['data_url']) };
        evidenceByReport.set(id, [...(evidenceByReport.get(id) ?? []), evidence]);
      }
      const reports: Report[] = rows(db, `SELECT reports.*, machines.name AS machine_name FROM reports
        JOIN machines ON machines.id = reports.machine_id ORDER BY date DESC, time DESC, reports.id DESC`).map((row) => ({
        id: number(row['id']), machineId: number(row['machine_id']), machineName: text(row['machine_name']),
        date: text(row['date']), time: text(row['time']), description: text(row['description']),
        createdAt: text(row['created_at']), updatedAt: text(row['updated_at']), evidence: evidenceByReport.get(number(row['id'])) ?? []
      }));
      return { machines, reports };
    });
  }

  private checkUniqueMachine(db: Database, name: string, exceptId = 0): void {
    if (rows(db, 'SELECT id, name FROM machines').some((row) => number(row['id']) !== exceptId && key(text(row['name'])) === key(name))) {
      throw new Error('Ya existe una máquina con ese nombre.');
    }
  }

  async createMachine(input: MachineInput): Promise<void> {
    const value = validateMachine(input);
    await this.write((db) => {
      this.checkUniqueMachine(db, value.name);
      db.run('INSERT INTO machines (name, location, created_at) VALUES (?, ?, ?)', [value.name, value.location, now()]);
    });
  }
  async updateMachine(id: number, input: MachineInput): Promise<void> {
    requireId(id); const value = validateMachine(input);
    await this.write((db) => {
      this.checkUniqueMachine(db, value.name, id);
      db.run('UPDATE machines SET name = ?, location = ? WHERE id = ?', [value.name, value.location, id]);
      if (!db.getRowsModified()) throw new Error('La máquina ya no existe.');
    });
  }
  async deleteMachine(id: number): Promise<void> {
    requireId(id);
    await this.write((db) => {
      db.run('DELETE FROM machines WHERE id = ?', [id]);
      if (!db.getRowsModified()) throw new Error('La máquina ya no existe.');
    });
  }
  private insertEvidence(db: Database, reportId: number, evidence: Evidence[]): void {
    for (const item of evidence) db.run('INSERT INTO evidence (report_id, name, mime_type, data_url) VALUES (?, ?, ?, ?)', [reportId, item.name, item.mimeType, item.dataUrl]);
  }
  async createReport(input: ReportInput): Promise<void> {
    const value = validateReport(input);
    await this.write((db) => {
      if (!rows(db, 'SELECT id FROM machines WHERE id = ?', [value.machineId]).length) throw new Error('La máquina seleccionada ya no existe.');
      const timestamp = now();
      db.run('INSERT INTO reports (machine_id, date, time, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [value.machineId, value.date, value.time, value.description, timestamp, timestamp]);
      this.insertEvidence(db, lastId(db), value.evidence);
    });
  }
  async updateReport(id: number, input: ReportInput): Promise<void> {
    requireId(id); const value = validateReport(input);
    await this.write((db) => {
      if (!rows(db, 'SELECT id FROM machines WHERE id = ?', [value.machineId]).length) throw new Error('La máquina seleccionada ya no existe.');
      db.run('UPDATE reports SET machine_id = ?, date = ?, time = ?, description = ?, updated_at = ? WHERE id = ?',
        [value.machineId, value.date, value.time, value.description, now(), id]);
      if (!db.getRowsModified()) throw new Error('El informe ya no existe.');
      db.run('DELETE FROM evidence WHERE report_id = ?', [id]);
      this.insertEvidence(db, id, value.evidence);
    });
  }
  async deleteReport(id: number): Promise<void> {
    requireId(id);
    await this.write((db) => {
      db.run('DELETE FROM reports WHERE id = ?', [id]);
      if (!db.getRowsModified()) throw new Error('El informe ya no existe.');
    });
  }
  async exportDatabase(): Promise<Uint8Array> {
    const bytes = await this.storage.read();
    if (!bytes) throw new Error('Todavía no hay una base de datos disponible.');
    return bytes;
  }

  async prepareImport(bytes: Uint8Array, legacyImages: File[]): Promise<PreparedImport> {
    if (bytes.length > MAX_DATABASE_BYTES) throw new Error('La base supera el límite de 100 MB.');
    if (new TextDecoder().decode(bytes.slice(0, 16)) !== 'SQLite format 3\0') throw new Error('El archivo no es una base SQLite válida.');
    const sql = await this.sql();
    let input: Database;
    try { input = new sql.Database(bytes); } catch { throw new Error('No se pudo abrir la base SQLite. Puede estar dañada.'); }
    const output = new sql.Database();
    try {
      const integrity = rows(input, 'PRAGMA quick_check');
      if (text(integrity[0]?.['quick_check']) !== 'ok') throw new Error('La base de datos está dañada.');
      const tables = tableNames(input);
      output.run(SCHEMA);
      if (tables.has('machines') && tables.has('reports') && tables.has('evidence')) {
        return this.checkImportSize(this.importCurrent(input, output));
      }
      if (tables.has('maquinas') && tables.has('informes')) {
        return this.checkImportSize(await this.importLegacy(input, output, legacyImages));
      }
      throw new Error('La base no corresponde a Nexo ni al proyecto anterior.');
    } catch (error) {
      if (error instanceof Error && !/no such column|malformed|file is not a database|no such table/i.test(error.message)) throw error;
      throw new Error('La estructura de la base no es compatible o está dañada.');
    } finally { input.close(); output.close(); }
  }

  private checkImportSize(prepared: PreparedImport): PreparedImport {
    if (prepared.bytes.length > MAX_DATABASE_BYTES) throw new Error('La base migrada supera el límite de 100 MB.');
    return prepared;
  }

  private importCurrent(input: Database, output: Database): PreparedImport {
    this.assertCurrentSchema(input);
    const machines = rows(input, 'SELECT id, name, location, created_at FROM machines ORDER BY id');
    const reports = rows(input, 'SELECT id, machine_id, date, time, description, created_at, updated_at FROM reports ORDER BY id');
    const evidence = rows(input, 'SELECT id, report_id, name, mime_type, data_url FROM evidence ORDER BY id');
    output.run('BEGIN TRANSACTION');
    const machineIds = new Set<number>();
    for (const row of machines) {
      const id = number(row['id']); requireId(id);
      const machine = validateMachine({ name: text(row['name']), location: text(row['location']) });
      this.checkUniqueMachine(output, machine.name);
      output.run('INSERT INTO machines (id, name, location, created_at) VALUES (?, ?, ?, ?)', [id, machine.name, machine.location, text(row['created_at']) || now()]);
      machineIds.add(id);
    }
    const reportIds = new Set<number>();
    const counts = new Map<number, number>();
    for (const row of reports) {
      const id = number(row['id']); requireId(id);
      const value = validateReport({ machineId: number(row['machine_id']), date: text(row['date']), time: text(row['time']), description: text(row['description']), evidence: [] });
      if (!machineIds.has(value.machineId)) throw new Error('Hay informes que apuntan a una máquina inexistente.');
      output.run('INSERT INTO reports (id, machine_id, date, time, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, value.machineId, value.date, value.time, value.description, text(row['created_at']) || now(), text(row['updated_at']) || now()]);
      reportIds.add(id);
    }
    for (const row of evidence) {
      const id = number(row['id']); const reportId = number(row['report_id']); requireId(id);
      if (!reportIds.has(reportId)) throw new Error('Hay evidencias que apuntan a un informe inexistente.');
      const item: Evidence = { name: text(row['name']), mimeType: text(row['mime_type']) as Evidence['mimeType'], dataUrl: text(row['data_url']) };
      validateEvidence(item);
      counts.set(reportId, (counts.get(reportId) ?? 0) + 1);
      if ((counts.get(reportId) ?? 0) > MAX_EVIDENCE) throw new Error('Un informe contiene demasiadas evidencias.');
      output.run('INSERT INTO evidence (id, report_id, name, mime_type, data_url) VALUES (?, ?, ?, ?, ?)', [id, reportId, item.name, item.mimeType, item.dataUrl]);
    }
    output.run('COMMIT');
    return { bytes: output.export(), source: 'nexo', machineCount: machines.length, reportCount: reports.length, evidenceCount: evidence.length, missingEvidence: [] };
  }

  private async importLegacy(input: Database, output: Database, files: File[]): Promise<PreparedImport> {
    const oldMachines = rows(input, 'SELECT id, nombre FROM maquinas ORDER BY id');
    const oldReports = rows(input, 'SELECT id, nombre_maquina, fecha, hora, descripcion, imagen, creado_en FROM informes ORDER BY id');
    const fileMap = new Map(files.map((file) => [file.name, file]));
    const converted = new Map<string, Evidence>();
    const missing = new Set<string>();
    // Decode before opening the SQL transaction; a bad/missing file must not silently disappear.
    for (const row of oldReports) {
      const filename = text(row['imagen']);
      if (!filename || converted.has(filename) || missing.has(filename)) continue;
      const file = fileMap.get(filename);
      if (!file) { missing.add(filename); continue; }
      try { converted.set(filename, await readEvidence(file)); } catch { missing.add(filename); }
    }
    output.run('BEGIN TRANSACTION');
    const machineMap = new Map<string, number>();
    const addMachine = (originalName: string): number => {
      const normalizedKey = key(originalName);
      const previous = machineMap.get(normalizedKey);
      if (previous) return previous;
      const machine = validateMachine({ name: originalName, location: '' });
      output.run('INSERT INTO machines (name, location, created_at) VALUES (?, ?, ?)', [machine.name, '', now()]);
      const id = lastId(output);
      machineMap.set(normalizedKey, id);
      return id;
    };
    oldMachines.forEach((row) => addMachine(text(row['nombre'])));
    let evidenceCount = 0;
    for (const row of oldReports) {
      const machineId = addMachine(text(row['nombre_maquina']));
      const rawTime = text(row['hora']).slice(0, 5);
      const timestamp = text(row['creado_en']) || now();
      const filename = text(row['imagen']);
      const item = converted.get(filename);
      const value = validateReport({ machineId, date: text(row['fecha']), time: validTime(rawTime) ? rawTime : '00:00', description: text(row['descripcion']), evidence: item ? [item] : [] });
      output.run('INSERT INTO reports (machine_id, date, time, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [value.machineId, value.date, value.time, value.description, timestamp, timestamp]);
      this.insertEvidence(output, lastId(output), value.evidence);
      evidenceCount += value.evidence.length;
    }
    output.run('COMMIT');
    return { bytes: output.export(), source: 'legacy', machineCount: machineMap.size, reportCount: oldReports.length, evidenceCount, missingEvidence: [...missing] };
  }

  async restore(prepared: PreparedImport): Promise<void> {
    await this.storage.modify(() => ({ bytes: prepared.bytes, result: undefined }));
  }
}
