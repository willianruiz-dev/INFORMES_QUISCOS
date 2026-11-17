import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { displayDate } from '../../core/domain/dates';
import { Machine } from '../../core/domain/models';

@Component({
  selector: 'app-machines', standalone: true,
  imports: [FormsModule, RouterLink, LucideDynamicIcon],
  templateUrl: './machines.component.html', styleUrl: './machines.component.css'
})
export class MachinesComponent {
  readonly store = inject(ReportFacade);
  readonly ui = inject(UiService);
  readonly displayDate = displayDate;
  search = '';
  error = '';
  get filtered(): Machine[] {
    const term = this.search.trim().toLocaleLowerCase('es');
    return this.store.machines().filter((machine) => `${machine.name} ${machine.location}`.toLocaleLowerCase('es').includes(term));
  }
  count(id: number): number { return this.store.reports().filter((report) => report.machineId === id).length; }
  lastDate(id: number): string { return this.store.reports().find((report) => report.machineId === id)?.date ?? ''; }
  async remove(machine: Machine): Promise<void> {
    const count = this.count(machine.id);
    if (!window.confirm(`¿Eliminar «${machine.name}»? También se eliminarán sus ${count} informe(s) y evidencias. Esta acción no se puede deshacer.`)) return;
    this.error = '';
    try { await this.store.deleteMachine(machine.id); this.ui.notify('Máquina e informes asociados eliminados.'); }
    catch (error) { this.error = this.store.message(error); }
  }
}
