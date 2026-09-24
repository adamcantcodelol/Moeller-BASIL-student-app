import type { FoldseekNormalizedSearch } from "@/adapters/foldseek";
import { DataCollapse } from "@/components/ui/DataCollapse";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

export function FoldseekResults({
  normalized,
  jobs,
}: {
  normalized: FoldseekNormalizedSearch | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;
  if (!normalized) {
    return (
      <div className="card">
        <EmptyScientificPanel
          title="Normalized Foldseek hits"
          message="No Foldseek search has completed yet."
        />
        {latestJob?.status === "failed" && latestJob.error ? (
          <p className="error">Last job failed: {latestJob.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Normalized Foldseek hits</h3>
      <p className="muted">
        PDB {normalized.pdbId} · mode {normalized.mode} · db {normalized.database}{" "}
        · {normalized.hitCount} hit{normalized.hitCount === 1 ? "" : "s"} (showing
        up to 50) · ticket {normalized.ticketId}
      </p>
      <p className="muted">
        Source: {normalized.provenance.source} · {normalized.provenance.retrievedAt}
      </p>
      {normalized.hits.length === 0 ? (
        <p className="muted">
          Foldseek returned zero hits. That is a real empty result.
        </p>
      ) : (
        <DataCollapse label="Foldseek hit table" count={normalized.hits.length} noun="hits">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>SeqId</th>
                  <th>E-value</th>
                  <th>Score</th>
                  <th>Prob</th>
                  <th>Query</th>
                </tr>
              </thead>
              <tbody>
                {normalized.hits.map((hit, index) => (
                  <tr key={`${hit.target}-${index}`}>
                    <td>{hit.target}</td>
                    <td>{hit.seqId ?? "—"}</td>
                    <td>{hit.eValue ?? "—"}</td>
                    <td>{hit.score ?? "—"}</td>
                    <td>{hit.probability ?? "—"}</td>
                    <td>
                      {hit.qStart !== null && hit.qEnd !== null
                        ? `${hit.qStart}–${hit.qEnd}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCollapse>
      )}
    </div>
  );
}
