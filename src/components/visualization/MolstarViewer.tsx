"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { EvidenceResidue } from "@/types/evidence";

/**
 * Mol* is loaded from the pinned jsDelivr CDN build (not Turbopack-bundled).
 * Coordinates are loaded live from RCSB. Active-site residues must come from
 * student evidence — never invented.
 *
 * Mount rules (flashing fix):
 * - Create Viewer once per enabled+scriptReady lifecycle.
 * - Dispose only on effect cleanup (unmount / disable).
 * - Never put unstable object/array props in init or load deps.
 * - evidenceResidues is display-only; default is a stable empty constant.
 * - Mode toggles that do not change loaded PDBs only update status text.
 */

const MOLSTAR_VERSION = "5.11.0";
const MOLSTAR_JS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.js`;
const MOLSTAR_CSS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.css`;

/** Stable default so missing prop does not reinvent [] every render. */
const EMPTY_RESIDUES: EvidenceResidue[] = [];

export type MolstarMode = "protein" | "overlay" | "active-site" | "active-site-overlay";

interface MolstarViewerApi {
  loadPdb: (id: string) => Promise<unknown>;
  plugin?: { clear?: () => void; dispose?: () => void };
  dispose?: () => void;
}

interface MolstarNamespace {
  Viewer: {
    create: (
      target: string | HTMLElement,
      options?: Record<string, unknown>,
    ) => Promise<MolstarViewerApi>;
  };
}

declare global {
  interface Window {
    molstar?: MolstarNamespace;
  }
}

function ensureMolstarCss() {
  const existing = document.querySelector(
    `link[data-molstar-css="${MOLSTAR_VERSION}"]`,
  );
  if (existing) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = MOLSTAR_CSS;
  link.dataset.molstarCss = MOLSTAR_VERSION;
  document.head.appendChild(link);
}

function isMolstarAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.molstar);
}

function disposeViewer(viewer: MolstarViewerApi | null) {
  if (!viewer) {
    return;
  }
  try {
    viewer.dispose?.();
  } catch {
    try {
      viewer.plugin?.dispose?.();
    } catch {
      /* ignore dispose races during Strict Mode remount */
    }
  }
}

function formatResidues(residues: EvidenceResidue[]): string {
  if (residues.length === 0) {
    return "none recorded";
  }
  return residues
    .map(
      (residue) =>
        `${residue.chain ? `${residue.chain}:` : ""}${residue.position}${residue.aminoAcid ? residue.aminoAcid : ""}`,
    )
    .join(", ");
}

function needsComparison(mode: MolstarMode): boolean {
  return mode === "overlay" || mode === "active-site-overlay";
}

function needsActiveSiteNote(mode: MolstarMode): boolean {
  return mode === "active-site" || mode === "active-site-overlay";
}

function statusMessage(
  pdbId: string,
  uiMode: MolstarMode,
  comparisonPdbId: string | null,
  evidenceResidues: EvidenceResidue[],
): string {
  const residueNote = needsActiveSiteNote(uiMode)
    ? ` Evidence residues: ${formatResidues(evidenceResidues)}.`
    : "";
  const overlayNote =
    needsComparison(uiMode) && comparisonPdbId ? ` + ${comparisonPdbId}` : "";
  return `Displaying ${pdbId}${overlayNote} (coordinates from files.rcsb.org).${residueNote}`;
}

export function MolstarViewer({
  pdbId,
  enabled,
  mode = "protein",
  comparisonPdbId = null,
  evidenceResidues = EMPTY_RESIDUES,
}: {
  pdbId: string;
  /** Only mount after RCSB metadata confirms the entry exists. */
  enabled: boolean;
  mode?: MolstarMode;
  comparisonPdbId?: string | null;
  evidenceResidues?: EvidenceResidue[];
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<MolstarViewerApi | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(isMolstarAvailable);
  const [viewerGeneration, setViewerGeneration] = useState(0);
  const [status, setStatus] = useState<string>("Waiting for Mol*…");
  const [error, setError] = useState<string | null>(null);
  const [uiMode, setUiMode] = useState<MolstarMode>(mode);

  const loadComparison = needsComparison(uiMode) ? comparisonPdbId : null;
  const structureKey = `${pdbId}::${loadComparison ?? ""}`;
  // Primitive signature so a fresh [] / mapped array from parents cannot retrigger work.
  const residueSignature = evidenceResidues
    .map(
      (residue) =>
        `${residue.chain ?? ""}:${residue.position}:${residue.aminoAcid ?? ""}`,
    )
    .join("|");

  useEffect(() => {
    if (enabled) {
      ensureMolstarCss();
    }
  }, [enabled]);

  // Create once; dispose only on cleanup. No unstable object/array deps.
  useEffect(() => {
    if (!enabled || !scriptReady || !window.molstar) {
      return;
    }
    const maybeHost = hostRef.current;
    if (!maybeHost) {
      return;
    }
    const mountTarget: HTMLElement = maybeHost;

    let cancelled = false;

    async function create() {
      setError(null);
      setStatus("Starting Mol* viewer…");
      try {
        mountTarget.innerHTML = "";
        const viewer = await window.molstar!.Viewer.create(mountTarget, {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: true,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          viewportShowExpand: true,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
        });
        if (cancelled) {
          disposeViewer(viewer);
          return;
        }
        viewerRef.current = viewer;
        loadedKeyRef.current = null;
        setViewerGeneration((value) => value + 1);
      } catch (createError) {
        if (!cancelled) {
          setError(
            createError instanceof Error
              ? createError.message
              : "Mol* failed to start.",
          );
          setStatus("Mol* start failed.");
        }
      }
    }

    void create();

    return () => {
      cancelled = true;
      disposeViewer(viewerRef.current);
      viewerRef.current = null;
      loadedKeyRef.current = null;
      mountTarget.innerHTML = "";
    };
  }, [enabled, scriptReady]);

  // Load structures only when the PDB set changes (or viewer was recreated).
  useEffect(() => {
    const maybeViewer = viewerRef.current;
    if (
      !enabled ||
      !scriptReady ||
      !maybeViewer ||
      !pdbId ||
      viewerGeneration === 0
    ) {
      return;
    }
    const activeViewer: MolstarViewerApi = maybeViewer;
    if (loadedKeyRef.current === structureKey) {
      return;
    }

    let cancelled = false;

    async function load() {
      setError(null);
      setStatus(`Loading ${pdbId} from RCSB via Mol*…`);
      try {
        activeViewer.plugin?.clear?.();
        await activeViewer.loadPdb(pdbId);
        if (cancelled) {
          return;
        }
        if (loadComparison) {
          await activeViewer.loadPdb(loadComparison);
        }
        if (cancelled) {
          return;
        }
        loadedKeyRef.current = structureKey;
        setStatus(
          statusMessage(pdbId, uiMode, comparisonPdbId, evidenceResidues),
        );
      } catch (loadError) {
        if (!cancelled) {
          loadedKeyRef.current = null;
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Mol* failed to load the structure from RCSB.",
          );
          setStatus("Mol* load failed.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // evidenceResidues / uiMode labels updated in a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- structureKey captures load inputs
  }, [enabled, scriptReady, pdbId, structureKey, viewerGeneration, loadComparison]);

  // Status text only — never dispose/recreate the viewer for residue/mode labels.
  useEffect(() => {
    if (!enabled || !pdbId || loadedKeyRef.current === null) {
      return;
    }
    if (loadedKeyRef.current !== structureKey) {
      return;
    }
    setStatus(statusMessage(pdbId, uiMode, comparisonPdbId, evidenceResidues));
    // residueSignature stands in for evidenceResidues identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- display-only sync
  }, [
    comparisonPdbId,
    enabled,
    pdbId,
    residueSignature,
    structureKey,
    uiMode,
    viewerGeneration,
  ]);

  if (!enabled) {
    return (
      <section className="card">
        <h3>Mol* viewer</h3>
        <p className="muted">
          Retrieve verified RCSB metadata first. The viewer loads real
          coordinates from RCSB and will not invent a structure or active site.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Mol* viewer</h3>
      <p className="muted">
        Interactive view of <strong>{pdbId}</strong>. Modes use real RCSB
        coordinates. Active-site labels come only from recorded evidence.
      </p>
      <div className="mode-row">
        <button
          type="button"
          className={uiMode === "protein" ? "" : "secondary"}
          onClick={() => setUiMode("protein")}
        >
          Protein
        </button>
        <button
          type="button"
          className={uiMode === "overlay" ? "" : "secondary"}
          onClick={() => setUiMode("overlay")}
          disabled={!comparisonPdbId}
        >
          Overlay
        </button>
        <button
          type="button"
          className={uiMode === "active-site" ? "" : "secondary"}
          onClick={() => setUiMode("active-site")}
        >
          Active site
        </button>
        <button
          type="button"
          className={uiMode === "active-site-overlay" ? "" : "secondary"}
          onClick={() => setUiMode("active-site-overlay")}
          disabled={!comparisonPdbId}
        >
          Active-site overlay
        </button>
      </div>
      {!comparisonPdbId ? (
        <p className="muted">
          Overlay modes unlock when a comparison PDB ID is provided by a later
          structural match — they are not invented here.
        </p>
      ) : null}
      {(uiMode === "active-site" || uiMode === "active-site-overlay") && (
        <p className="muted">
          Highlight targets from evidence: {formatResidues(evidenceResidues)}.
          Use the ChimeraX script for precise selections if Mol* selection
          styling is limited in this CDN viewer build.
        </p>
      )}
      <Script
        src={MOLSTAR_JS}
        strategy="afterInteractive"
        onLoad={() => {
          setScriptReady(true);
        }}
        onError={() => {
          setError(
            "Could not load the Mol* viewer script from jsDelivr. Check network access on this computer.",
          );
        }}
      />
      <p className="muted">{status}</p>
      {error ? <p className="error">{error}</p> : null}
      <div ref={hostRef} className="molstar-host" />
    </section>
  );
}
