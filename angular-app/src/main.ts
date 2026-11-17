import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/presentation/layout/app.component';

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => console.error(error));
