import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { filter } from 'rxjs';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { MachineFormComponent } from '../machine-form/machine-form.component';
import { ReportFormComponent } from '../report-form/report-form.component';
import { ExportPanelComponent } from '../export-panel/export-panel.component';
import { ModalFocusDirective } from '../../shared/modal-focus.directive';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideDynamicIcon, MachineFormComponent, ReportFormComponent, ExportPanelComponent, ModalFocusDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly store = inject(ReportFacade);
  readonly ui = inject(UiService);
  private readonly router = inject(Router);
  readonly mobileMenu = signal(false);
  readonly pageTitle = signal('Panel general');
  readonly dateLabel = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const path = this.router.url.split('?')[0];
      this.pageTitle.set(path.startsWith('/maquinas') ? 'Máquinas' : path.startsWith('/informes') ? 'Informes' : path.startsWith('/datos') ? 'Mis datos' : 'Panel general');
      this.mobileMenu.set(false);
    });
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.ui.reportDialog()) this.ui.reportDialog.set(null);
    else if (this.ui.machineDialog()) this.ui.machineDialog.set(null);
    else if (this.ui.exportDialog()) this.ui.exportDialog.set(false);
    else this.mobileMenu.set(false);
  }
}
