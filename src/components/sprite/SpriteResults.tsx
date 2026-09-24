import { DataCollapse } from "@/components/ui/DataCollapse";
import type { SpriteNormalizedSearch } from "@/adapters/sprite";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";
import {
  formatOneResidue,
  pairResidues,
} from "@/components/sprite/residueFormat";

type SpriteHit = SpriteNormalizedSearch["hits"][number];

type RmsdBand = {
  id: string;
  label: string;
  hits: SpriteHit[];
};

/** Group already RMSD-sorted hits into classroom-friendly bands. */
function groupHitsByRmsd(hits: SpriteHit[]): RmsdBand[] {
  const bands: RmsdBand[] = [
    { id: "lt1", label: "RMSD < 1.0 Å (very close)", hits: [] },
    { id: "1to2", label: "RMSD 1.0–2.0 Å", hits: [] },
    { id: "2to3", label: "RMSD 2.0–3.0 Å", hits: [] },
    { id: "gt3", label: "RMSD ≥ 3.0 Å", hits: [] },
    { id: "unknown", label: "RMSD not reported", hits: [] },
  ];

  for (const hit of hits) {
    if (hit.rmsd === null) {
      bands[4].hits.push(hit);
    } else if (hit.rmsd < 1) {
      bands[0].hits.push(hit);
    } else if (hit.rmsd < 2) {
      bands[1].hits.push(hit);
    } else if (hit.rmsd < 3) {
      bands[2].hits.push(hit);
    } else {
      bands[3].hits.push(hit);
    }
  }

  return bands.filter((band) => band.hits.length > 0);
}

/**
 * Two-column paired list: known active site | your match, plus ↔ line for screen readers / compact view.
 */
function PairedResidueColumns({ hit }: { hit: SpriteHit }) {
  const pairs = pairResidues(hit.patResidues, hit.matchResidues);
  if (pairs.length === 0) {
    return (
      <>
        <td className="muted">—</td>
        <td className="muted">—</td>
      </>
    );
  }
  return (
    <>
      <td>
        <ul className="sprite-residue-list">
          {pairs.map((pair) => (
            <li key={`pat-${pair.index}`}>
              {formatOneResidue(pair.pattern)}
            </li>
          ))}
        </ul>
      </td>
      <td>
        <ul className="sprite-residue-list">
          {pairs.map((pair) => (
            <li key={`match-${pair.index}`}>
              <span className="sprite-res-arrow-inline" aria-hidden="true">
                ↔{" "}
              </span>
              {formatOneResidue(pair.match)}
            </li>
          ))}
        </ul>
      </td>
    </>
  );
}

function HitsTable({ hits }: { hits: SpriteHit[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table sprite-hits-table">
        <thead>
          <tr>
            <th>PDB</th>
            <th>Pattern</th>
            <th>Size</th>
            <th>RMSD (Å)</th>
            <th>Description</th>
            <th>Known active site</th>
            <th>Your matching residues</th>
          </tr>
        </thead>
        <tbody>
          {hits.map((hit, index) => (
            <tr
              key={`${hit.pdbId}-${hit.patternId ?? index}-${hit.rmsd ?? "na"}`}
            >
              <td>{hit.pdbId}</td>
              <td>{hit.patternId ?? "—"}</td>
              <td>{hit.size ?? "—"}</td>
              <td>{hit.rmsd ?? "—"}</td>
              <td>{hit.description ?? "—"}</td>
              <PairedResidueColumns hit={hit} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpriteResults({
  normalized,
  jobs,
}: {
  normalized: SpriteNormalizedSearch | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;
  const running =
    latestJob?.status === "running" || latestJob?.status === "queued";

  if (!normalized) {
    return (
      <div className="card">
        <EmptyScientificPanel
          title="Normalized SPRITE matches"
          message={
            running
              ? "SPRITE job is still running on the Worker. Keep this page open or refresh later."
              : "No SPRITE search has completed yet."
          }
        />
        {latestJob?.status === "failed" && latestJob.error ? (
          <p className="error">Last job failed: {latestJob.error}</p>
        ) : null}
      </div>
    );
  }

  const bands = groupHitsByRmsd(normalized.hits);

  return (
    <div className="card">
      <h3>Normalized SPRITE matches</h3>
      <p className="muted">
        PDB {normalized.pdbId} · db {normalized.database} · showing{" "}
        {normalized.hitCount}
        {normalized.totalResults !== null
          ? ` of ${normalized.totalResults}`
          : ""}{" "}
        match{normalized.hitCount === 1 ? "" : "es"} · session{" "}
        {normalized.sessionId}
      </p>
      <p className="muted">
        Residues are paired by position:{" "}
        <strong>Known active site</strong> (pattern) ↔{" "}
        <strong>Your matching residues</strong>. Leftovers stay listed if
        lengths differ. Lower RMSD = closer 3D match. Source:{" "}
        {normalized.provenance.source} · {normalized.provenance.retrievedAt}
      </p>
      {normalized.hits.length === 0 ? (
        <p className="muted">
          SPRITE returned zero matches. That is a real empty result.
        </p>
      ) : (
        bands.map((band, index) => (
          <DataCollapse
            key={band.id}
            className="sprite-rmsd-band"
            label={<strong>{band.label}</strong>}
            count={band.hits.length}
            noun={band.hits.length === 1 ? "match" : "matches"}
            // Closest band open (unless huge); other bands start collapsed.
            defaultOpen={index === 0 && band.hits.length <= 25}
          >
            <HitsTable hits={band.hits} />
          </DataCollapse>
        ))
      )}
    </div>
  );
}
