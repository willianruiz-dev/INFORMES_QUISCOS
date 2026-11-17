import { computed, inject, Injectable, signal } from '@angular/core';
import { REPORT_REPOSITORY } from './tokens';
import { Machine, MachineInput, PreparedImport, Report, ReportInput } from '../domain/models';
import { localDate } from '../domain/dates';

@Injectable({ providedIn: 'root' })
export class ReportFacade {
  private readonly repository = inject(REPORT_REPOSITORY);
  readonly machines = signal<Machine[]>([]);
  readonly reports = signal<Report[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly evidenceCount = computed(() => this.reports().reduce((count, report) => count + report.evidence.length, 0));
  readonly reportsThisMonth = computed(() => this.reports().filter((report) => report.date.startsWith(localDate().slice(0, 7))).length);

  constructor() {
    this.repository.onExternalChange(() => { void this.refresh(); });
    void this.initialize();
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.repository.initialize();
      await this.refresh();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    try {
      const snapshot = await this.repository.snapshot();
      this.machines.set(snapshot.machines);
      this.reports.set(snapshot.reports);
      this.error.set('');
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  async createMachine(input: MachineInput): Promise<void> { await this.repository.createMachine(input); await this.refresh(); }
  async updateMachine(id: number, input: MachineInput): Promise<void> { await this.repository.updateMachine(id, input); await this.refresh(); }
  async deleteMachine(id: number): Promise<void> { await this.repository.deleteMachine(id); await this.refresh(); }
  async createReport(input: ReportInput): Promise<void> { await this.repository.createReport(input); await this.refresh(); }
  async updateReport(id: number, input: ReportInput): Promise<void> { await this.repository.updateReport(id, input); await this.refresh(); }
  async deleteReport(id: number): Promise<void> { await this.repository.deleteReport(id); await this.refresh(); }
  exportDatabase(): Promise<Uint8Array> { return this.repository.exportDatabase(); }
  prepareImport(bytes: Uint8Array, images: File[]): Promise<PreparedImport> { return this.repository.prepareImport(bytes, images); }
  async restore(prepared: PreparedImport): Promise<void> { await this.repository.restore(prepared); await this.refresh(); }

  message(error: unknown): string {
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
}
