export const PROJECT_STATUSES = ["active", "archived", "demo"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Project {
  id: string;
  name: string;
  studentId: string | null;
  status: ProjectStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}
