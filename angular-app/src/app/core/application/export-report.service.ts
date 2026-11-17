import { Injectable, inject } from '@angular/core';
import { validDate } from '../domain/dates';
import { PdfOptions, Report } from '../domain/models';
import { PDF_EXPORTER } from './tokens';

@Injectable({ providedIn: 'root' })
export class ExportReportService {
  private readonly exporter = inject(PDF_EXPORTER);
  async execute(options: PdfOptions, reports: Report[]): Promise<void> {
    if (!options.title.trim()) throw new Error('Escribe un título para el informe.');
    if (!validDate(options.startDate) || !validDate(options.endDate) || options.startDate > options.endDate) {
      throw new Error('Selecciona un período válido. La fecha final debe ser posterior a la inicial.');
    }
    const selected = reports.filter((report) => report.date >= options.startDate && report.date <= options.endDate);
    if (!selected.length) throw new Error('No hay informes en este período. Cambia las fechas o crea una novedad.');
    await this.exporter.download(options, selected);
  }
}
