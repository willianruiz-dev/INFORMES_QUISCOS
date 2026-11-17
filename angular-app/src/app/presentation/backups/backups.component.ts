import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { localDate } from '../../core/domain/dates';
import { PreparedImport } from '../../core/domain/models';
import { MAX_DATABASE_BYTES } from '../../core/domain/ports';


@Component({
  selector: 'app-backups', standalone: true,
  imports: [FormsModule, LucideDynamicIcon],
  templateUrl: './backups.component.html', styleUrl: './backups.component.css'
})
export class BackupsComponent {
  @ViewChild('backupInput') backupInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagesInput') imagesInput?: ElementRef<HTMLInputElement>;
  readonly store = inject(ReportFacade);
  readonly ui = inject(UiService);
  file?: File;
  legacyImages: File[] = [];
  url = '';
  prepared?: PreparedImport;
  error = '';
  busy = false;
  sourceLabel = '';

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0]; this.prepared = undefined; this.error = '';
  }
  selectImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.legacyImages = Array.from(input.files ?? []); this.prepared = undefined; this.error = '';
  }

  async exportBackup(): Promise<void> {
    this.error = ''; this.busy = true;
    try {
      const bytes = await this.store.exportDatabase();
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/vnd.sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `nexo-respaldo-${localDate()}.sqlite`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.ui.notify('Copia de seguridad descargada.');
    } catch (error) { this.error = this.store.message(error); }
    finally { this.busy = false; }
  }

  async prepareFile(): Promise<void> {
    if (!this.file) { this.error = 'Selecciona primero una base SQLite.'; return; }
    if (this.file.size > MAX_DATABASE_BYTES) { this.error = 'La base supera el límite de 100 MB.'; return; }
    this.busy = true; this.error = ''; this.prepared = undefined;
    try {
      this.prepared = await this.store.prepareImport(new Uint8Array(await this.file.arrayBuffer()), this.legacyImages);
      this.sourceLabel = this.file.name;
    } catch (error) { this.error = this.store.message(error); }
    finally { this.busy = false; }
  }

  async prepareUrl(): Promise<void> {
    this.error = ''; this.prepared = undefined;
    let parsed: URL;
    try { parsed = new URL(this.url); } catch { this.error = 'Escribe una URL completa y válida.'; return; }
    if (parsed.protocol !== 'https:' && parsed.origin !== window.location.origin) {
      this.error = 'La URL debe usar HTTPS (o ser del mismo sitio).'; return;
    }
    this.busy = true;
    try {
      const response = await fetch(parsed.href, { credentials: 'omit' });
      if (!response.ok) throw new Error(`No se pudo descargar la base (HTTP ${response.status}).`);
      const declaredSize = Number(response.headers.get('Content-Length') ?? 0);
      if (declaredSize > MAX_DATABASE_BYTES) throw new Error('La base supera el límite de 100 MB.');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo leer la respuesta de la URL.');
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        total += result.value.length;
        if (total > MAX_DATABASE_BYTES) { await reader.cancel(); throw new Error('La base supera el límite de 100 MB.'); }
        chunks.push(result.value);
      }
      const bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      this.prepared = await this.store.prepareImport(bytes, this.legacyImages);
      this.sourceLabel = parsed.href;
    } catch (error) {
      this.error = error instanceof TypeError ? 'No se pudo acceder a la URL. Verifica que sea pública y permita CORS.' : this.store.message(error);
    } finally { this.busy = false; }
  }

  async restore(): Promise<void> {
    if (!this.prepared || this.busy) return;
    const missing = this.prepared.missingEvidence.length;
    const warning = missing ? `\n\nFaltan ${missing} archivo(s) de evidencia: esos informes se importarán sin esas imágenes.` : '';
    if (!window.confirm(`Esto reemplazará TODOS los datos actuales de este navegador. Descarga primero una copia de seguridad si deseas conservarlos.${warning}\n\n¿Deseas continuar?`)) return;
    this.busy = true; this.error = '';
    try {
      await this.store.restore(this.prepared);
      this.ui.notify('Base de datos restaurada correctamente.');
      this.prepared = undefined; this.file = undefined; this.legacyImages = []; this.url = '';
      if (this.backupInput) this.backupInput.nativeElement.value = '';
      if (this.imagesInput) this.imagesInput.nativeElement.value = '';
    } catch (error) { this.error = this.store.message(error); }
    finally { this.busy = false; }
  }
}
