export interface FileRecord {
  id: string;
  path: string;
  relativePath: string;
  projectId: string;
  contentHash: string;
  fileType: string;
  sizeBytes: number;
  lastModified: string;
  lastIngestedAt?: string;
  entityIds: string[];
  status: 'pending' | 'ingested' | 'failed' | 'excluded';
  parseError?: string;
}
