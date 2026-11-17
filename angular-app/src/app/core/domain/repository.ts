import { MachineInput, PreparedImport, ReportInput, Snapshot } from './models';

/** Port: application and UI know nothing about IndexedDB, SQL.js or the schema. */
export interface ReportRepository {
  initialize(): Promise<void>;
  snapshot(): Promise<Snapshot>;
  createMachine(input: MachineInput): Promise<void>;
  updateMachine(id: number, input: MachineInput): Promise<void>;
  deleteMachine(id: number): Promise<void>;
  createReport(input: ReportInput): Promise<void>;
  updateReport(id: number, input: ReportInput): Promise<void>;
  deleteReport(id: number): Promise<void>;
  exportDatabase(): Promise<Uint8Array>;
  prepareImport(bytes: Uint8Array, legacyImages: File[]): Promise<PreparedImport>;
  restore(prepared: PreparedImport): Promise<void>;
  onExternalChange(listener: () => void): () => void;
}
