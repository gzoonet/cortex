export interface Project {
  id: string;
  name: string;
  rootPath: string;
  privacyLevel: 'standard' | 'sensitive' | 'restricted';
  fileCount: number;
  entityCount: number;
  lastIngestedAt?: string;
  createdAt: string;
}
