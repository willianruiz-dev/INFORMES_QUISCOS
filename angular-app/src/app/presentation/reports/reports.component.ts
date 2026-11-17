import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { displayDate } from '../../core/domain/dates';
import { Evidence, Report } from '../../core/domain/models';

@Component({
  selector: 'app-reports', standalone: true,
  imports: [FormsModule, LucideDynamicIcon],
  templateUrl: './reports.component.html', styleUrl: './reports.component.css'
})
export class ReportsComponent {
  readonly store = inject(ReportFacade);
  readonly ui = inject(UiService);
  readonly displayDate = displayDate;
  search = '';
  machineId = 0;
  start = '';
  end = '';
  error = '';
  selectedEvidence?: Evidence;

  constructor() {
    inject(ActivatedRoute).queryParamMap.subscribe((params) => {
      const id = Number(params.get('maquina'));
      this.machineId = Number.isSafeInteger(id) && id > 0 ? id : 0;
    });
  }
  get filtered(): Report[] {
    const term = this.search.trim().toLocaleLowerCase('es');
    return this.store.reports().filter((report) =>
      (!this.machineId || report.machineId === this.machineId) &&
      (!this.start || report.date >= this.start) && (!this.end || report.date <= this.end) &&
      `${report.machineName} ${report.description}`.toLocaleLowerCase('es').includes(term)
    );
  }
  clearFilters(): void { this.search = ''; this.machineId = 0; this.start = ''; this.end = ''; }
  @HostListener('document:keydown.escape') closeImage(): void { this.selectedEvidence = undefined; }
  async remove(report: Report): Promise<void> {
    if (!window.confirm(`¿Eliminar el informe de «${report.machineName}» del ${displayDate(report.date)}? También se eliminarán sus evidencias.`)) return;
    this.error = '';
    try { await this.store.deleteReport(report.id); this.ui.notify('Informe eliminado correctamente.'); }
    catch (error) { this.error = this.store.message(error); }
  }
}
