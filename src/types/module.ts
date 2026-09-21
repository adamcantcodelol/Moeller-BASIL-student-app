export const MODULE_NUMBERS = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
] as const;

export type ModuleNumber = (typeof MODULE_NUMBERS)[number];

export interface BasilModuleDefinition {
  id: string;
  number: ModuleNumber;
  slug: string;
  name: string;
  description: string;
  purpose: string;
  instructions: string;
  order: number;
  implemented: boolean;
}

export interface CurriculumModuleRecord {
  id: string;
  number: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  implemented: boolean;
}
