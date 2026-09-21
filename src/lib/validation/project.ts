import { z } from "zod";

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(200),
  studentId: z.string().trim().max(100).optional().nullable(),
  pdbId: z.string().trim().optional().nullable(),
});

export const noteInputSchema = z.object({
  moduleId: z.string().min(1),
  content: z.string().trim().min(1, "Note content is required.").max(8000),
});

export const completePdbSetupSchema = z.object({
  complete: z.literal(true),
});
