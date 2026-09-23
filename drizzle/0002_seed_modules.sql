-- Curriculum catalog. pdb-setup (Phase 1/2) and interpro (Phase 4) are implemented.

INSERT INTO modules (id, number, slug, name, description, sort_order, implemented) VALUES
  ('pdb-setup', '00', 'pdb-setup', 'Protein / PDB Setup', 'Select and record a PDB identifier as the project''s input structure.', 0, 1),
  ('sprite', '01', 'sprite', 'SPRITE', 'Investigate structural and sequence relationships using SPRITE.', 1, 0),
  ('blast', '02', 'blast', 'BLAST', 'Compare protein sequences using BLAST.', 2, 0),
  ('interpro', '03', 'interpro', 'InterPro', 'Identify domains, families, and signatures.', 3, 1),
  ('clean', '04', 'clean', 'CLEAN', 'Perform the CLEAN analysis defined by BASIL.', 4, 0),
  ('dali', '05', 'dali', 'Dali', 'Compare protein structures using Dali.', 5, 0),
  ('foldseek', '06', 'foldseek', 'Foldseek', 'Search for structural homologs using Foldseek.', 6, 0),
  ('active-site-evidence', '07', 'active-site-evidence', 'Active-Site Evidence Synthesis', 'Combine evidence from earlier modules for candidate residues.', 7, 0),
  ('swissdock', '08', 'swissdock', 'SwissDock', 'Investigate ligand docking.', 8, 0),
  ('hypothesis-builder', '09', 'hypothesis-builder', 'Hypothesis Builder', 'Write a student-authored, evidence-linked hypothesis.', 9, 0),
  ('shannonbot-review', '10', 'shannonbot-review', 'ShannonBot Review', 'Discuss reasoning with the Socratic AI mentor.', 10, 0),
  ('reports', '11', 'reports', 'Reports', 'Generate reproducible student and teacher reports.', 11, 0);
