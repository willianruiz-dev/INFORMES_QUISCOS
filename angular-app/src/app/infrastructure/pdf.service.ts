import { Injectable } from '@angular/core';
import { displayDate } from '../core/domain/dates';
import { PdfOptions, Report } from '../core/domain/models';
import { PdfExporter } from '../core/domain/ports';

@Injectable({ providedIn: 'root' })
export class PdfService implements PdfExporter {
  private fonts?: Promise<[string, string]>;

  private async loadFonts(): Promise<[string, string]> {
    if (!this.fonts) {
      const load = async (path: string): Promise<string> => {
        const response = await fetch(new URL(path, document.baseURI));
        if (!response.ok) throw new Error('No se pudieron cargar las fuentes del PDF.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(binary);
      };
      this.fonts = Promise.all([load('assets/fonts/DejaVuSans.ttf'), load('assets/fonts/DejaVuSans-Bold.ttf')]);
    }
    return this.fonts;
  }

  async download(options: PdfOptions, reports: Report[]): Promise<void> {
    const [{ jsPDF }, [regular, bold]] = await Promise.all([import('jspdf'), this.loadFonts()]);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', putOnlyUsedFonts: true, compress: true });
    pdf.addFileToVFS('DejaVuSans.ttf', regular);
    pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
    pdf.addFileToVFS('DejaVuSans-Bold.ttf', bold);
    pdf.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
    pdf.setFont('DejaVu', 'normal');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 17;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;

    const setText = (color: string, size: number, style: 'normal' | 'bold' = 'normal'): void => {
      pdf.setFont('DejaVu', style); pdf.setFontSize(size); pdf.setTextColor(color);
    };
    const continuation = (): void => {
      pdf.addPage();
      pdf.setFillColor('#10223e'); pdf.rect(0, 0, pageWidth, 13, 'F');
      setText('#ffffff', 8, 'bold'); pdf.text('NEXO  /  INFORME TÉCNICO', margin, 8.5);
      y = 23;
    };
    const ensure = (height: number): void => { if (y + height > pageHeight - 21) continuation(); };

    pdf.setFillColor('#10223e'); pdf.rect(0, 0, pageWidth, 69, 'F');
    pdf.setFillColor('#36c8b2'); pdf.roundedRect(margin, 13, 3, 3, 1, 1, 'F');
    setText('#aabbd3', 8, 'bold'); pdf.text('NEXO  /  GESTIÓN DE MANTENIMIENTO', margin + 6, 16);
    setText('#ffffff', 17, 'bold');
    const titleLines = pdf.splitTextToSize(options.title, contentWidth) as string[];
    pdf.text(titleLines, margin, 29, { lineHeightFactor: 1.16 });
    setText('#b9c9df', 9);
    pdf.text(`PERÍODO  ${displayDate(options.startDate)}  AL  ${displayDate(options.endDate)}`, margin, 59);
    y = 79;
    const machineCount = new Set(reports.map((report) => report.machineId)).size;
    const evidenceCount = reports.reduce((sum, report) => sum + report.evidence.length, 0);
    setText('#172a45', 9, 'bold');
    const technicianLines = pdf.splitTextToSize(options.technician || 'Equipo técnico', 72) as string[];
    const summaryHeight = Math.max(25, 15 + technicianLines.length * 4);
    pdf.setFillColor('#f3f6fb'); pdf.roundedRect(margin, y, contentWidth, summaryHeight, 2, 2, 'F');
    const blocks = [
      { label: 'TÉCNICO RESPONSABLE', value: options.technician || 'Equipo técnico' },
      { label: 'MÁQUINAS', value: String(machineCount) },
      { label: 'NOVEDADES', value: String(reports.length) },
      { label: 'EVIDENCIAS', value: String(evidenceCount) }
    ];
    const offsets = [0, 81, 113, 146];
    blocks.forEach((block, index) => {
      const x = margin + 5 + offsets[index];
      setText('#8190a5', 6.5, 'bold'); pdf.text(block.label, x, y + 8);
      setText('#172a45', 9, 'bold');
      pdf.text(index === 0 ? technicianLines : block.value, x, y + 17, { lineHeightFactor: 1.15 });
    });
    y += summaryHeight + 12;

    const sorted = [...reports].sort((a, b) => a.machineName.localeCompare(b.machineName, 'es') || a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id);
    let previousMachine = -1;
    for (const report of sorted) {
      if (report.machineId !== previousMachine) {
        previousMachine = report.machineId;
        setText('#183256', 10, 'bold');
        const machineLines = pdf.splitTextToSize(report.machineName, contentWidth - 12) as string[];
        const machineHeight = Math.max(12, machineLines.length * 5 + 7);
        ensure(machineHeight + 16);
        pdf.setFillColor('#eaf1fc'); pdf.roundedRect(margin, y, contentWidth, machineHeight, 1.8, 1.8, 'F');
        pdf.setFillColor('#2c6be2'); pdf.rect(margin, y, 1.2, machineHeight, 'F');
        setText('#183256', 10, 'bold'); pdf.text(machineLines, margin + 5, y + 7, { lineHeightFactor: 1.2 });
        y += machineHeight + 7;
      }
      ensure(24);
      setText('#2c6be2', 8, 'bold'); pdf.text(`${displayDate(report.date)}  ·  ${report.time}`, margin + 1, y);
      setText('#95a1b1', 7); pdf.text(`REGISTRO #${String(report.id).padStart(3, '0')}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
      setText('#33445c', 9);
      const lines = pdf.splitTextToSize(report.description, contentWidth - 2) as string[];
      for (const line of lines) {
        ensure(5);
        setText('#33445c', 9); pdf.text(line || ' ', margin + 1, y); y += 4.8;
      }
      y += 3;
      if (report.evidence.length) {
        ensure(12);
        setText('#8190a5', 7, 'bold'); pdf.text(`EVIDENCIA FOTOGRÁFICA  (${report.evidence.length})`, margin + 1, y); y += 5;
        const cellWidth = 52;
        const cellHeight = 38;
        for (let index = 0; index < report.evidence.length; index++) {
          if (index % 3 === 0) ensure(cellHeight + 4);
          const item = report.evidence[index];
          const x = margin + 1 + (index % 3) * (cellWidth + 5);
          pdf.setFillColor('#f4f6fa'); pdf.roundedRect(x, y, cellWidth, cellHeight, 1.5, 1.5, 'F');
          try {
            const properties = pdf.getImageProperties(item.dataUrl);
            const scale = Math.min((cellWidth - 4) / properties.width, (cellHeight - 4) / properties.height);
            const width = properties.width * scale;
            const height = properties.height * scale;
            pdf.addImage(item.dataUrl, item.mimeType === 'image/png' ? 'PNG' : 'JPEG', x + (cellWidth - width) / 2, y + (cellHeight - height) / 2, width, height);
          } catch {
            throw new Error(`No se pudo incluir la evidencia «${item.name}» en el PDF. Reemplázala e inténtalo de nuevo.`);
          }
          if (index % 3 === 2 || index === report.evidence.length - 1) y += cellHeight + 5;
        }
      }
      ensure(6);
      pdf.setDrawColor('#e5eaf1'); pdf.line(margin, y, pageWidth - margin, y); y += 9;
    }

    const totalPages = pdf.getNumberOfPages();
    const generated = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    for (let page = 1; page <= totalPages; page++) {
      pdf.setPage(page);
      pdf.setDrawColor('#e6ebf2'); pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      setText('#8694a8', 7);
      pdf.text(`NEXO  ·  Generado ${generated}`, margin, pageHeight - 9);
      pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
    }
    pdf.save(`informe_tecnico_${options.startDate}_${options.endDate}.pdf`);
  }
}
