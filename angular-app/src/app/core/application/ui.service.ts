import { Injectable, signal } from '@angular/core';
import { Machine, Report } from '../domain/models';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly machineDialog = signal<{ machine?: Machine } | null>(null);
  readonly reportDialog = signal<{ report?: Report; machineId?: number } | null>(null);
  readonly exportDialog = signal(false);
  readonly toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  openMachine(machine?: Machine): void { this.machineDialog.set({ machine }); }
  openReport(report?: Report, machineId?: number): void { this.reportDialog.set({ report, machineId }); }
  notify(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3500);
  }
}
