import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { localDate, localTime } from '../../core/domain/dates';
import { Evidence, Report } from '../../core/domain/models';
import { MAX_EVIDENCE } from '../../core/domain/ports';
import { EvidenceService } from '../../core/application/evidence.service';

@Component({
  selector: 'app-report-form', standalone: true,
  imports: [FormsModule, LucideDynamicIcon],
  templateUrl: './report-form.component.html', styleUrl: './report-form.component.css'
})
export class ReportFormComponent implements OnInit {
  @Input() report?: Report;
  @Input() initialMachineId?: number;
  @Output() closed = new EventEmitter<void>();
  readonly store = inject(ReportFacade);
  readonly ui = inject(UiService);
  private readonly evidenceService = inject(EvidenceService);
  machineId = 0;
  date = localDate();
  time = localTime();
  description = '';
  evidence: Evidence[] = [];
  error = '';
  saving = false;
  reading = false;
  dragging = false;
  readonly maxEvidence = MAX_EVIDENCE;

  ngOnInit(): void {
    if (this.report) {
      this.machineId = this.report.machineId;
      this.date = this.report.date;
      this.time = this.report.time;
      this.description = this.report.description;
      this.evidence = [...this.report.evidence];
    } else if (this.initialMachineId) this.machineId = this.initialMachineId;
  }

  @HostListener('document:paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile()).filter((file): file is File => !!file);
    if (files.length) { event.preventDefault(); void this.addFiles(files); }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }
  onDrop(event: DragEvent): void {
    event.preventDefault(); this.dragging = false;
    void this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }
  onDragOver(event: DragEvent): void { event.preventDefault(); this.dragging = true; }

  async addFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    if (this.reading) { this.error = 'Espera a que termine de procesarse la imagen anterior.'; return; }
    this.error = '';
    if (this.evidence.length + files.length > MAX_EVIDENCE) { this.error = `Puedes agregar hasta ${MAX_EVIDENCE} imágenes por informe.`; return; }
    this.reading = true;
    try {
      const added: Evidence[] = [];
      for (const file of files) added.push(await this.evidenceService.read(file));
      this.evidence = [...this.evidence, ...added];
    } catch (error) { this.error = this.store.message(error); }
    finally { this.reading = false; }
  }

  async pasteFromClipboard(): Promise<void> {
    if (!navigator.clipboard?.read) { this.error = 'Usa Ctrl + V (o ⌘ + V) para pegar la captura en el formulario.'; return; }
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          files.push(new File([blob], `captura-${Date.now()}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`, { type }));
        }
      }
      if (!files.length) { this.error = 'No encontramos una imagen en el portapapeles. Copia un recorte y vuelve a intentarlo.'; return; }
      await this.addFiles(files);
    } catch { this.error = 'No se pudo leer el portapapeles. Da permiso al navegador o pega con Ctrl + V (⌘ + V en Mac).'; }
  }

  createMachine(): void { this.closed.emit(); this.ui.openMachine(); }

  async save(): Promise<void> {
    if (this.saving || this.reading) return;
    this.error = '';
    if (!this.machineId || !this.date || !this.time || !this.description.trim()) { this.error = 'Completa la máquina, la fecha, la hora y la descripción.'; return; }
    this.saving = true;
    try {
      const input = { machineId: this.machineId, date: this.date, time: this.time, description: this.description, evidence: this.evidence };
      if (this.report) await this.store.updateReport(this.report.id, input);
      else await this.store.createReport(input);
      this.ui.notify(this.report ? 'Informe actualizado correctamente.' : 'Informe guardado correctamente.');
      this.closed.emit();
    } catch (error) { this.error = this.store.message(error); }
    finally { this.saving = false; }
  }
}
