import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { fortnightRange, monthRange, validDate } from '../../core/domain/dates';
import { ExportReportService } from '../../core/application/export-report.service';

@Component({
  selector: 'app-export-panel', standalone: true,
  imports: [FormsModule, LucideDynamicIcon],
  templateUrl: './export-panel.component.html', styleUrl: './export-panel.component.css'
})
export class ExportPanelComponent {
  @Input() inModal = false;
  readonly store = inject(ReportFacade);
  private readonly exporter = inject(ExportReportService);
  private readonly ui = inject(UiService);
  title = 'Informe técnico de máquinas';
  technician = 'Equipo técnico';
  start = monthRange().start;
  end = monthRange().end;
  preset: 'month' | 'fortnight' | 'all' | 'custom' = 'month';
  error = '';
  generating = false;

  get rangeValid(): boolean { return validDate(this.start) && validDate(this.end) && this.start <= this.end; }
  get selectedReports() { return this.store.reports().filter((report) => report.date >= this.start && report.date <= this.end); }

  setPreset(preset: 'month' | 'fortnight' | 'all'): void {
    this.preset = preset; this.error = '';
    if (preset === 'all') {
      const dates = this.store.reports().map((report) => report.date).sort();
      const fallback = monthRange();
      this.start = dates[0] ?? fallback.start;
      this.end = dates[dates.length - 1] ?? fallback.end;
    } else {
      const range = preset === 'month' ? monthRange() : fortnightRange();
      this.start = range.start; this.end = range.end;
    }
  }

  async download(): Promise<void> {
    this.error = '';
    if (!this.title.trim()) { this.error = 'Escribe un título para el informe.'; return; }
    if (!this.rangeValid) { this.error = 'Selecciona un período válido. La fecha final debe ser posterior a la inicial.'; return; }
    if (!this.selectedReports.length) { this.error = 'No hay informes en este período. Cambia las fechas o crea una novedad.'; return; }
    this.generating = true;
    try {
      await this.exporter.execute({ title: this.title.trim(), technician: this.technician.trim(), startDate: this.start, endDate: this.end }, this.store.reports());
      this.ui.notify('Tu informe PDF está listo.');
    } catch (error) { this.error = this.store.message(error); }
    finally { this.generating = false; }
  }
}
