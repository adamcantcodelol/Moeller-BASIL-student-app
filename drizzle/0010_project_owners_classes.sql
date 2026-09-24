-- Lightweight project ownership (no accounts) + teacher-created classes.
-- owner_type: 'device' (anonymous device cookie) or 'class' (class code + student name).
-- Legacy rows keep NULL owner and stay reachable by direct link only.

ALTER TABLE projects ADD COLUMN owner_type TEXT;
ALTER TABLE projects ADD COLUMN owner_key TEXT;
ALTER TABLE projects ADD COLUMN class_code TEXT;
ALTER TABLE projects ADD COLUMN student_name TEXT;

CREATE INDEX idx_projects_owner ON projects(owner_type, owner_key);
CREATE INDEX idx_projects_class_code ON projects(class_code);

CREATE TABLE classes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);
