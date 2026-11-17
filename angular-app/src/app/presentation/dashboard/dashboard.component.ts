import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ReportFacade } from '../../core/application/report-facade.service';
import { UiService } from '../../core/application/ui.service';
import { displayDate } from '../../core/domain/dates';
import { ExportPanelComponent } from '../export-panel/export-panel.component';

@Component({
  selector: 'app-dashboard', standalone: true,
  imports: [RouterLink, LucideDynamicIcon, ExportPanelComponent],
  templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  readonly store = inject(ReportFacade);
  readonly ui = inject(UiService);
  readonly displayDate = displayDate;
  readonly today = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  countReports(id: number): number { return this.store.reports().filter((report) => report.machineId === id).length; }
}
