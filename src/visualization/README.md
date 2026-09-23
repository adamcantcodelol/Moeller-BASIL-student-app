# Visualization

Phase 2 loads Mol* from the pinned jsDelivr viewer build
(`molstar@5.11.0`) inside `MolstarViewer`. The npm package is intentionally
not bundled through Next.js 16 Turbopack.

Coordinates come from RCSB (`viewer.loadPdb`). Active-site highlighting and
Mode A/B/C overlays are deferred until evidence modules exist — visualization
must not invent scientific truth.
