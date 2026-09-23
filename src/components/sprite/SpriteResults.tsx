import type { SpriteNormalizedSearch } from "@/adapters/sprite";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

function formatResidues(
  residues: SpriteNormalizedSearch["hits"][number]["matchResidues"],
): string {
  if (residues.length === 0) {
    return "—";
  }
  return residues
    .map((r) => {
      const loc = [r.chain, r.resNo].filter(Boolean).join(":");
      return r.resType ? `${r.resType}${loc ? `(${loc})` : ""}` : loc || "?";
    })
    .join(", ");
}

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

function HitsTable({ hits }: { hits: SpriteHit[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>PDB</th>
            <th>Pattern</th>
            <th>Size</th>
            <th>RMSD (Å)</th>
            <th>Description</th>
            <th>Match residues</th>
          </tr>
        </thead>
        <tbody>
          {hits.map((hit, index) => (
            <tr key={`${hit.pdbId}-${hit.patternId ?? index}-${hit.rmsd ?? "na"}`}>
              <td>{hit.pdbId}</td>
              <td>{hit.patternId ?? "—"}</td>
              <td>{hit.size ?? "—"}</td>
              <td>{hit.rmsd ?? "—"}</td>
              <td>{hit.description ?? "—"}</td>
              <td>{formatResidues(hit.matchResidues)}</td>
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
        Organized by RMSD (lowest / best structural match first). Source:{" "}
        {normalized.provenance.source} · {normalized.provenance.retrievedAt}
      </p>
      {normalized.hits.length === 0 ? (
        <p className="muted">
          SPRITE returned zero matches. That is a real empty result.
        </p>
      ) : (
        bands.map((band) => (
          <section key={band.id} className="sprite-rmsd-band">
            <h4>
              {band.label}{" "}
              <span className="muted">({band.hits.length})</span>
            </h4>
            <HitsTable hits={band.hits} />
          </section>
        ))
      )}
    </div>
  );
}
