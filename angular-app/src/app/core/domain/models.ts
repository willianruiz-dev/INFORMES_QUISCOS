export interface Machine {
  id: number;
  name: string;
  location: string;
  createdAt: string;
}

export interface MachineInput {
  name: string;
  location: string;
}

export interface Evidence {
  id?: number;
  name: string;
  mimeType: 'image/png' | 'image/jpeg';
  dataUrl: string;
}

export interface Report {
  id: number;
  machineId: number;
  machineName: string;
  date: string;
  time: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  evidence: Evidence[];
}

export interface ReportInput {
  machineId: number;
  date: string;
  time: string;
  description: string;
  evidence: Evidence[];
}

export interface Snapshot {
  machines: Machine[];
  reports: Report[];
}

export interface PreparedImport {
  bytes: Uint8Array;
  source: 'nexo' | 'legacy';
  machineCount: number;
  reportCount: number;
  evidenceCount: number;
  missingEvidence: string[];
}

export interface PdfOptions {
  title: string;
  technician: string;
  startDate: string;
  endDate: string;
}
