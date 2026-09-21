import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    studentId: text("student_id"),
    status: text("status").notNull().default("active"),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("projects_status_check", sql`${table.status} IN ('active', 'archived', 'demo')`),
    check("projects_is_demo_check", sql`${table.isDemo} IN (0, 1)`),
  ],
);

export const structures = sqliteTable(
  "structures",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pdbId: text("pdb_id").notNull(),
    title: text("title"),
    organism: text("organism"),
    chainsJson: text("chains_json"),
    sequence: text("sequence"),
    metadataJson: text("metadata_json"),
    source: text("source").notNull(),
    retrievedAt: text("retrieved_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("structures_project_id_unique").on(table.projectId),
    check(
      "structures_source_check",
      sql`${table.source} IN ('student_input', 'rcsb', 'demo', 'import')`,
    ),
  ],
);

export const modules = sqliteTable("modules", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().unique(),
  implemented: integer("implemented", { mode: "boolean" }).notNull().default(false),
});

export const moduleRuns = sqliteTable(
  "module_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id),
    status: text("status").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    parametersJson: text("parameters_json"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("module_runs_project_module_unique").on(
      table.projectId,
      table.moduleId,
    ),
    index("idx_module_runs_project").on(table.projectId),
    check(
      "module_runs_status_check",
      sql`${table.status} IN ('not_started', 'in_progress', 'complete', 'error', 'not_available_yet')`,
    ),
  ],
);

export const results = sqliteTable(
  "results",
  {
    id: text("id").primaryKey(),
    moduleRunId: text("module_run_id")
      .notNull()
      .references(() => moduleRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    rawDataJson: text("raw_data_json"),
    normalizedDataJson: text("normalized_data_json"),
    source: text("source"),
    provenanceJson: text("provenance_json"),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_results_run").on(table.moduleRunId),
    check(
      "results_type_check",
      sql`${table.type} IN ('raw', 'normalized', 'interpretation')`,
    ),
    check("results_is_demo_check", sql`${table.isDemo} IN (0, 1)`),
  ],
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    description: text("description").notNull(),
    sourceResultId: text("source_result_id").references(() => results.id),
    residuesJson: text("residues_json"),
    strength: text("strength"),
    provenanceJson: text("provenance_json"),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_evidence_project").on(table.projectId),
    check("evidence_is_demo_check", sql`${table.isDemo} IN (0, 1)`),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_notes_project_module").on(table.projectId, table.moduleId)],
);

export const hypotheses = sqliteTable("hypotheses", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const hypothesisVersions = sqliteTable("hypothesis_versions", {
  id: text("id").primaryKey(),
  hypothesisId: text("hypothesis_id")
    .notNull()
    .references(() => hypotheses.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  reasonForChange: text("reason_for_change"),
  createdAt: text("created_at").notNull(),
});

export const aiConversations = sqliteTable("ai_conversations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  messagesJson: text("messages_json").notNull(),
  evidenceReferencesJson: text("evidence_references_json"),
  createdAt: text("created_at").notNull(),
});

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fileReference: text("file_reference"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("reports_type_check", sql`${table.type} IN ('student', 'teacher')`),
  ],
);

export const schema = {
  projects,
  structures,
  modules,
  moduleRuns,
  results,
  evidence,
  notes,
  hypotheses,
  hypothesisVersions,
  aiConversations,
  reports,
};
