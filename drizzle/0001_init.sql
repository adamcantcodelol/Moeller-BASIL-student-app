-- Complete Phase 1 relational schema.
-- Scientific result tables exist for later phases and stay empty here.

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  student_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'demo')),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE structures (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  pdb_id TEXT NOT NULL,
  title TEXT,
  organism TEXT,
  chains_json TEXT,
  sequence TEXT,
  metadata_json TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('student_input', 'rcsb', 'demo', 'import')),
  retrieved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE,
  implemented INTEGER NOT NULL DEFAULT 0 CHECK (implemented IN (0, 1))
);

CREATE TABLE module_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id),
  status TEXT NOT NULL
    CHECK (status IN (
      'not_started',
      'in_progress',
      'complete',
      'error',
      'not_available_yet'
    )),
  started_at TEXT,
  completed_at TEXT,
  parameters_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, module_id)
);

CREATE INDEX idx_module_runs_project ON module_runs(project_id);

CREATE TABLE results (
  id TEXT PRIMARY KEY,
  module_run_id TEXT NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('raw', 'normalized', 'interpretation')),
  raw_data_json TEXT,
  normalized_data_json TEXT,
  source TEXT,
  provenance_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_results_run ON results(module_run_id);

CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  source_result_id TEXT REFERENCES results(id),
  residues_json TEXT,
  strength TEXT,
  provenance_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_evidence_project ON evidence(project_id);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_notes_project_module ON notes(project_id, module_id);

CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE hypothesis_versions (
  id TEXT PRIMARY KEY,
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  reason_for_change TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  messages_json TEXT NOT NULL,
  evidence_references_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('student', 'teacher')),
  file_reference TEXT,
  created_at TEXT NOT NULL
);
