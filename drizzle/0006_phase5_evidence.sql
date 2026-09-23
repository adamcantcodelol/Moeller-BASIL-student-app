-- Phase 5: link evidence rows to the curriculum module that justified them.
ALTER TABLE evidence ADD COLUMN source_module_id TEXT REFERENCES modules(id);
