"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import type { EvidenceResidue } from "@/types/evidence";

/**
 * Mol* is loaded from the pinned jsDelivr CDN build (not Turbopack-bundled).
 * Coordinates are loaded live from RCSB. Active-site residues must come from
 * student evidence — never invented.
 */

const MOLSTAR_VERSION = "5.11.0";
const MOLSTAR_JS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.js`;
const MOLSTAR_CSS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.css`;

export type MolstarMode = "protein" | "overlay" | "active-site" | "active-site-overlay";

interface MolstarViewerApi {
  loadPdb: (id: string) => Promise<unknown>;
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

export function MolstarViewer({
  pdbId,
  enabled,
  mode = "protein",
  comparisonPdbId = null,
  evidenceResidues = [],
}: {
  pdbId: string;
  /** Only mount after RCSB metadata confirms the entry exists. */
  enabled: boolean;
  mode?: MolstarMode;
  comparisonPdbId?: string | null;
  evidenceResidues?: EvidenceResidue[];
}) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `molstar-${reactId}`;
  const viewerRef = useRef<MolstarViewerApi | null>(null);
  const [scriptReady, setScriptReady] = useState(isMolstarAvailable);
  const [status, setStatus] = useState<string>("Waiting for Mol*…");
  const [error, setError] = useState<string | null>(null);
  const [uiMode, setUiMode] = useState<MolstarMode>(mode);

  useEffect(() => {
    if (enabled) {
      ensureMolstarCss();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !scriptReady || !window.molstar) {
      return;
    }

    let cancelled = false;

    async function mount() {
      setError(null);
      setStatus(`Loading ${pdbId} from RCSB via Mol*…`);
      try {
        if (viewerRef.current?.dispose) {
          viewerRef.current.dispose();
          viewerRef.current = null;
        }
        const target = document.getElementById(containerId);
        if (!target) {
          return;
        }
        target.innerHTML = "";
        const viewer = await window.molstar!.Viewer.create(target, {
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
          viewer.dispose?.();
          return;
        }
        viewerRef.current = viewer;
        await viewer.loadPdb(pdbId);
        if (
          (uiMode === "overlay" || uiMode === "active-site-overlay") &&
          comparisonPdbId
        ) {
          await viewer.loadPdb(comparisonPdbId);
        }
        if (!cancelled) {
          const residueNote =
            uiMode === "active-site" || uiMode === "active-site-overlay"
              ? ` Evidence residues: ${formatResidues(evidenceResidues)}.`
              : "";
          setStatus(
            `Displaying ${pdbId}${comparisonPdbId && (uiMode === "overlay" || uiMode === "active-site-overlay") ? ` + ${comparisonPdbId}` : ""} (coordinates from files.rcsb.org).${residueNote}`,
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Mol* failed to load the structure from RCSB.",
          );
          setStatus("Mol* load failed.");
        }
      }
    }

    void mount();

    return () => {
      cancelled = true;
      viewerRef.current?.dispose?.();
      viewerRef.current = null;
    };
  }, [
    comparisonPdbId,
    containerId,
    enabled,
    evidenceResidues,
    pdbId,
    scriptReady,
    uiMode,
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
      <div id={containerId} className="molstar-host" />
    </section>
  );
}
