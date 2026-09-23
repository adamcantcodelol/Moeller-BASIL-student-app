-- Phase 4: InterPro module becomes implemented (live REST + import fallback).
UPDATE modules SET implemented = 1 WHERE id = 'interpro';
