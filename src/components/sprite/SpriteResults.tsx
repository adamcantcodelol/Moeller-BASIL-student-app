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
        Source: {normalized.provenance.source} ·{" "}
        {normalized.provenance.retrievedAt}
      </p>
      {normalized.hits.length === 0 ? (
        <p className="muted">
          SPRITE returned zero matches. That is a real empty result.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>PDB</th>
                <th>Pattern</th>
                <th>Size</th>
                <th>RMSD</th>
                <th>Description</th>
                <th>Match residues</th>
              </tr>
            </thead>
            <tbody>
              {normalized.hits.map((hit, index) => (
                <tr key={`${hit.pdbId}-${hit.patternId ?? index}`}>
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
      )}
    </div>
  );
}
