import { Evidence, PdfOptions, Report } from './models';

export const MAX_EVIDENCE = 8;
export const MAX_DATABASE_BYTES = 100 * 1024 * 1024;

/** Ports implemented in infrastructure; use cases never depend on browser libraries. */
export interface EvidenceReader { read(file: File): Promise<Evidence>; }
export interface PdfExporter { download(options: PdfOptions, reports: Report[]): Promise<void>; }
