import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import {
  provideLucideIcons, LucideLayoutDashboard, LucideMonitorCog, LucideClipboardList, LucideDatabaseBackup,
  LucidePlus, LucideCalendarDays, LucideFileText, LucideImages, LucideArrowUpRight, LucideArrowRight,
  LucideChevronRight, LucideMenu, LucideX, LucideSearch, LucideSlidersHorizontal, LucideFileDown,
  LucideClock3, LucidePencil, LucideTrash, LucideMapPin, LucideUpload, LucideImagePlus, LucideClipboardPaste,
  LucideCheck, LucideShieldCheck, LucideDatabase, LucideCircleQuestionMark, LucideLayers2, LucideDownload,
  LucideFolderOpen, LucideTriangleExclamationPoint, LucideLink, LucideExternalLink, LucideEllipsis,
  LucideRefreshCw, LucideSparkles, LucideActivity, LucideEye, LucideFileClock, LucideCircleCheck,
  LucideHardDrive, LucideImage, LucideChevronDown, LucideInbox, LucideLockKeyhole, LucideCopy,
  LucideCheckCheck, LucidePanelLeftClose, LucideCalendarRange, LucideArrowLeft, LucideMousePointer2,
  LucideWrench, LucideCirclePlus, LucideMonitor, LucideCloudUpload, LucideInfo, LucideListFilter
} from '@lucide/angular';
import { REPORT_REPOSITORY, EVIDENCE_READER, PDF_EXPORTER } from './core/application/tokens';
import { BrowserEvidenceReader } from './infrastructure/image-codec';
import { PdfService } from './infrastructure/pdf.service';
import { SqliteReportRepository } from './infrastructure/sqlite-report.repository';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    { provide: REPORT_REPOSITORY, useExisting: SqliteReportRepository },
    { provide: EVIDENCE_READER, useExisting: BrowserEvidenceReader },
    { provide: PDF_EXPORTER, useExisting: PdfService },
    provideLucideIcons(
      LucideLayoutDashboard, LucideMonitorCog, LucideClipboardList, LucideDatabaseBackup,
      LucidePlus, LucideCalendarDays, LucideFileText, LucideImages, LucideArrowUpRight, LucideArrowRight,
      LucideChevronRight, LucideMenu, LucideX, LucideSearch, LucideSlidersHorizontal, LucideFileDown,
      LucideClock3, LucidePencil, LucideTrash, LucideMapPin, LucideUpload, LucideImagePlus, LucideClipboardPaste,
      LucideCheck, LucideShieldCheck, LucideDatabase, LucideCircleQuestionMark, LucideLayers2, LucideDownload,
      LucideFolderOpen, LucideTriangleExclamationPoint, LucideLink, LucideExternalLink, LucideEllipsis,
      LucideRefreshCw, LucideSparkles, LucideActivity, LucideEye, LucideFileClock, LucideCircleCheck,
      LucideHardDrive, LucideImage, LucideChevronDown, LucideInbox, LucideLockKeyhole, LucideCopy,
      LucideCheckCheck, LucidePanelLeftClose, LucideCalendarRange, LucideArrowLeft, LucideMousePointer2,
      LucideWrench, LucideCirclePlus, LucideMonitor, LucideCloudUpload, LucideInfo, LucideListFilter
    )
  ]
};
