-- Server-side app settings (teacher-managed). Values for secrets are stored
-- AES-GCM encrypted (key derived from the TEACHER_PASSWORD Worker secret);
-- the plaintext secret is never returned to the browser.
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
