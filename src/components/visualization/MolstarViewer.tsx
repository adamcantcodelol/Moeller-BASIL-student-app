"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { EvidenceResidue } from "@/types/evidence";
import {
  formatEvidenceResidues,
  residuesToStructureElements,
} from "@/lib/molstar/activeSiteOverlay";

/**
 * Mol* is loaded from the pinned jsDelivr CDN build (not Turbopack-bundled).
 * Coordinates are loaded live from RCSB. Active-site residues must come from
 * student evidence — never invented.
 *
 * Mount rules (flashing fix):
 * - Create Viewer once per enabled+scriptReady lifecycle.
 * - Dispose only on effect cleanup (unmount / disable).
 * - Never put unstable object/array props in init or load deps.
 * - evidenceResidues default is a stable empty constant.
 * - Mode / residue changes update structureInteractivity without remounting.
 */

const MOLSTAR_VERSION = "5.11.0";
const MOLSTAR_JS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.js`;
const MOLSTAR_CSS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.css`;

/** Stable default so missing prop does not reinvent [] every render. */
const EMPTY_RESIDUES: EvidenceResidue[] = [];

export type MolstarMode =
  | "protein"
  | "overlay"
  | "active-site"
  | "active-site-overlay";

interface StructureInteractivityOptions {
  elements?: {
    items: Array<{ auth_asym_id?: string; auth_seq_id: number }>;
  };
  action:
    | "highlight"
    | "select"
    | "focus"
    | Array<"highlight" | "select" | "focus">;
  applyGranularity?: boolean;
}

interface MolstarViewerApi {
  loadPdb: (id: string) => Promise<unknown>;
  structureInteractivity?: (options: StructureInteractivityOptions) => void;
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

function needsComparison(mode: MolstarMode): boolean {
  return mode === "overlay" || mode === "active-site-overlay";
}

function needsActiveSite(mode: MolstarMode): boolean {
  return mode === "active-site" || mode === "active-site-overlay";
}

function resolveUiMode(
  mode: MolstarMode,
  comparisonPdbId: string | null,
): MolstarMode {
  if (!comparisonPdbId && needsComparison(mode)) {
    return mode === "active-site-overlay" ? "active-site" : "protein";
  }
  return mode;
}

function clearStructureInteractivity(viewer: MolstarViewerApi) {
  viewer.structureInteractivity?.({ action: "select" });
  viewer.structureInteractivity?.({ action: "highlight" });
}

function applyActiveSiteOverlay(
  viewer: MolstarViewerApi,
  residues: EvidenceResidue[],
): boolean {
  if (!viewer.structureInteractivity) {
    return false;
  }
  clearStructureInteractivity(viewer);
  if (residues.length === 0) {
    return false;
  }
  const items = residuesToStructureElements(residues);
  viewer.structureInteractivity({
    elements: { items },
    action: ["select", "focus"],
    applyGranularity: true,
  });
  return true;
}

function statusMessage(
  pdbId: string,
  uiMode: MolstarMode,
  comparisonPdbId: string | null,
  evidenceResidues: EvidenceResidue[],
  overlayApplied: boolean,
): string {
  const overlayNote =
    needsComparison(uiMode) && comparisonPdbId ? ` + ${comparisonPdbId}` : "";
  if (needsActiveSite(uiMode)) {
    if (evidenceResidues.length === 0) {
      return `Displaying ${pdbId}${overlayNote}. No active-site evidence residues recorded — nothing to highlight.`;
    }
    if (overlayApplied) {
      return `Displaying ${pdbId}${overlayNote}. Active-site focus: ${formatEvidenceResidues(evidenceResidues)}.`;
    }
    return `Displaying ${pdbId}${overlayNote}. Evidence residues listed (${formatEvidenceResidues(evidenceResidues)}) but Mol* interactivity is unavailable in this build.`;
  }
  return `Displaying ${pdbId}${overlayNote} (coordinates from files.rcsb.org).`;
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
  const [loadedStructureKey, setLoadedStructureKey] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState<string>("Waiting for Mol*…");
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<MolstarMode>(mode);

  const uiMode = resolveUiMode(selectedMode, comparisonPdbId);
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
        setLoadedStructureKey(null);
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
        setLoadedStructureKey(structureKey);
        setStatus(
          `Loaded ${pdbId}${loadComparison ? ` + ${loadComparison}` : ""}.`,
        );
      } catch (loadError) {
        if (!cancelled) {
          loadedKeyRef.current = null;
          setLoadedStructureKey(null);
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
  }, [
    enabled,
    scriptReady,
    pdbId,
    structureKey,
    viewerGeneration,
    loadComparison,
  ]);

  // Mode / residue overlay — never dispose/recreate the viewer.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (
      !enabled ||
      !pdbId ||
      !viewer ||
      loadedStructureKey === null ||
      loadedStructureKey !== structureKey
    ) {
      return;
    }

    let overlayApplied = false;
    if (needsActiveSite(uiMode)) {
      overlayApplied = applyActiveSiteOverlay(viewer, evidenceResidues);
    } else {
      clearStructureInteractivity(viewer);
    }
    setStatus(
      statusMessage(
        pdbId,
        uiMode,
        comparisonPdbId,
        evidenceResidues,
        overlayApplied,
      ),
    );
    // residueSignature stands in for evidenceResidues identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlay sync without remount
  }, [
    comparisonPdbId,
    enabled,
    loadedStructureKey,
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

  const showOverlayModes = Boolean(comparisonPdbId);
  const activeSiteEmpty =
    needsActiveSite(uiMode) && evidenceResidues.length === 0;

  return (
    <section className="card">
      <h3>Mol* viewer</h3>
      <p className="muted">
        Interactive view of <strong>{pdbId}</strong>. Modes use real RCSB
        coordinates. Active-site highlights come only from recorded evidence.
      </p>
      <div className="mode-row">
        <button
          type="button"
          className={uiMode === "protein" ? "" : "secondary"}
          onClick={() => setSelectedMode("protein")}
        >
          Protein
        </button>
        {showOverlayModes ? (
          <button
            type="button"
            className={uiMode === "overlay" ? "" : "secondary"}
            onClick={() => setSelectedMode("overlay")}
          >
            Overlay
          </button>
        ) : null}
        <button
          type="button"
          className={uiMode === "active-site" ? "" : "secondary"}
          onClick={() => setSelectedMode("active-site")}
        >
          Active site
        </button>
        {showOverlayModes ? (
          <button
            type="button"
            className={uiMode === "active-site-overlay" ? "" : "secondary"}
            onClick={() => setSelectedMode("active-site-overlay")}
          >
            Active-site overlay
          </button>
        ) : null}
      </div>
      {!showOverlayModes ? (
        <p className="muted">
          Overlay modes stay hidden until a comparison PDB ID is available from
          a structural match (for example Foldseek). They are not invented here.
        </p>
      ) : (
        <p className="muted">
          Comparison structure: <strong>{comparisonPdbId}</strong> (from stored
          structural match evidence).
        </p>
      )}
      {activeSiteEmpty ? (
        <p className="error" role="status">
          No active-site residues recorded yet. Add evidence residues in
          Active-Site Evidence Synthesis — the viewer will not invent or
          highlight positions.
        </p>
      ) : null}
      {needsActiveSite(uiMode) && evidenceResidues.length > 0 ? (
        <p className="muted">
          Highlighting evidence residues:{" "}
          {formatEvidenceResidues(evidenceResidues)}. Selection is focused in
          the viewport; ChimeraX script remains available for desktop analysis.
        </p>
      ) : null}
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
