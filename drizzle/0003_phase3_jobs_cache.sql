-- Phase 3: scientific job lifecycle + legitimate adapter response cache.

CREATE TABLE scientific_jobs (
  id TEXT PRIMARY KEY,
  module_run_id TEXT NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'awaiting_import')),
  mode TEXT NOT NULL
    CHECK (mode IN ('adapter', 'import')),
  parameters_json TEXT,
  error TEXT,
  cache_hit INTEGER NOT NULL DEFAULT 0 CHECK (cache_hit IN (0, 1)),
  result_id TEXT REFERENCES results(id) ON DELETE SET NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_scientific_jobs_run ON scientific_jobs(module_run_id);
CREATE INDEX idx_scientific_jobs_tool ON scientific_jobs(tool);

CREATE TABLE adapter_response_cache (
  cache_key TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_json TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  provenance_json TEXT
);

CREATE INDEX idx_adapter_cache_tool ON adapter_response_cache(tool);
CREATE INDEX idx_adapter_cache_expires ON adapter_response_cache(expires_at);
