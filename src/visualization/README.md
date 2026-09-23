# Visualization

Phase 2 loads Mol* from the pinned jsDelivr viewer build
(`molstar@5.11.0`) inside `MolstarViewer`. The npm package is intentionally
not bundled through Next.js 16 Turbopack.

Coordinates come from RCSB (`viewer.loadPdb`). Active-site mode uses
`viewer.structureInteractivity` to select + focus student evidence residues
without remounting the plugin. Overlay modes appear only when a comparison
PDB ID is available (for example a Foldseek hit) — they are never invented.
