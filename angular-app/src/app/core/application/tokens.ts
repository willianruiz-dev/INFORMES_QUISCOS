import { InjectionToken } from '@angular/core';
import { ReportRepository } from '../domain/repository';
import { EvidenceReader, PdfExporter } from '../domain/ports';

// Angular composition tokens live outside the framework-independent domain.
export const REPORT_REPOSITORY = new InjectionToken<ReportRepository>('REPORT_REPOSITORY');
export const EVIDENCE_READER = new InjectionToken<EvidenceReader>('EVIDENCE_READER');
export const PDF_EXPORTER = new InjectionToken<PdfExporter>('PDF_EXPORTER');
