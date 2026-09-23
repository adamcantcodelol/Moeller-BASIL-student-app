-- Classroom auto-analysis pipeline state (client-driven tick under Worker limits).

CREATE TABLE analysis_pipelines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN ('idle', 'running', 'completed', 'failed')),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  steps_json TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_analysis_pipelines_project ON analysis_pipelines(project_id);
CREATE INDEX idx_analysis_pipelines_status ON analysis_pipelines(status);
