"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";

/**
 * Mol* is loaded from the pinned jsDelivr CDN build (not Turbopack-bundled)
 * because molstar npm imports are unreliable under Next.js 16 Turbopack.
 * Coordinates are loaded live from RCSB files CDN by Mol* — we do not
 * fabricate structures. Active-site highlighting is intentionally omitted.
 */

const MOLSTAR_VERSION = "5.11.0";
const MOLSTAR_JS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.js`;
const MOLSTAR_CSS = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer/molstar.css`;

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

export function MolstarViewer({
  pdbId,
  enabled,
}: {
  pdbId: string;
  /** Only mount after RCSB metadata confirms the entry exists. */
  enabled: boolean;
}) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `molstar-${reactId}`;
  const viewerRef = useRef<MolstarViewerApi | null>(null);
  const [scriptReady, setScriptReady] = useState(isMolstarAvailable);
  const [status, setStatus] = useState<string>("Waiting for Mol*…");
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) {
          setStatus(`Displaying ${pdbId} (coordinates from files.rcsb.org).`);
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
  }, [containerId, enabled, pdbId, scriptReady]);

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
        Interactive view of <strong>{pdbId}</strong>. Mode A/B/C overlays and
        active-site highlighting require later evidence modules — they are not
        invented here.
      </p>
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
