import { Injectable, inject } from '@angular/core';
import { Evidence } from '../domain/models';
import { EVIDENCE_READER } from './tokens';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private readonly reader = inject(EVIDENCE_READER);
  read(file: File): Promise<Evidence> { return this.reader.read(file); }
}
