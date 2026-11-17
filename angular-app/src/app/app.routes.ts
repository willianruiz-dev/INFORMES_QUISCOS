import { Routes } from '@angular/router';
import { DashboardComponent } from './presentation/dashboard/dashboard.component';
import { MachinesComponent } from './presentation/machines/machines.component';
import { ReportsComponent } from './presentation/reports/reports.component';
import { BackupsComponent } from './presentation/backups/backups.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent, title: 'Panel general | Nexo' },
  { path: 'maquinas', component: MachinesComponent, title: 'Máquinas | Nexo' },
  { path: 'informes', component: ReportsComponent, title: 'Informes | Nexo' },
  { path: 'datos', component: BackupsComponent, title: 'Mis datos | Nexo' },
  { path: '**', redirectTo: '' }
];
