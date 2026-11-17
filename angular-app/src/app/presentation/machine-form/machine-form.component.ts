import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { Machine } from '../../core/domain/models';

@Component({
  selector: 'app-machine-form', standalone: true,
  imports: [FormsModule, LucideDynamicIcon],
  templateUrl: './machine-form.component.html', styleUrl: './machine-form.component.css'
})
export class MachineFormComponent implements OnInit {
  @Input() machine?: Machine;
  @Output() closed = new EventEmitter<void>();
  readonly store = inject(ReportFacade);
  private readonly ui = inject(UiService);
  name = '';
  location = '';
  error = '';
  saving = false;

  ngOnInit(): void { this.name = this.machine?.name ?? ''; this.location = this.machine?.location ?? ''; }
  async save(): Promise<void> {
    if (this.saving) return;
    this.error = '';
    if (!this.name.trim()) { this.error = 'Escribe el nombre de la máquina.'; return; }
    this.saving = true;
    try {
      const input = { name: this.name, location: this.location };
      if (this.machine) await this.store.updateMachine(this.machine.id, input);
      else await this.store.createMachine(input);
      this.ui.notify(this.machine ? 'Máquina actualizada correctamente.' : 'Máquina creada correctamente.');
      this.closed.emit();
    } catch (error) { this.error = this.store.message(error); }
    finally { this.saving = false; }
  }
}
