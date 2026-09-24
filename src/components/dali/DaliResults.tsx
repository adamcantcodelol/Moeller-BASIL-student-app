import type { DaliNormalizedSearch } from "@/adapters/dali";
import { DataCollapse } from "@/components/ui/DataCollapse";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

export function DaliResults({
  normalized,
  jobs,
}: {
  normalized: DaliNormalizedSearch | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;
  const running =
    latestJob?.status === "running" || latestJob?.status === "queued";

  if (!normalized) {
    return (
      <div className="card">
        <EmptyScientificPanel
          title="Normalized Dali hits"
          message={
            running
              ? "Dali job is still queued/running on the Worker. Refresh later."
              : "No Dali search has completed yet."
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
      <h3>Normalized Dali hits</h3>
      <p className="muted">
        {normalized.pdbId}
        {normalized.chain} · {normalized.hitCount} hit
        {normalized.hitCount === 1 ? "" : "s"}
      </p>
      <p className="muted">
        Source: {normalized.provenance.source} ·{" "}
        {normalized.provenance.retrievedAt}
      </p>
      {normalized.hits.length === 0 ? (
        <p className="muted">Dali returned zero hits. That is a real empty result.</p>
      ) : (
        <DataCollapse label="Dali hit table" count={normalized.hits.length} noun="hits">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Chain</th>
                  <th>Z</th>
                  <th>RMSD</th>
                  <th>lali</th>
                  <th>%id</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {normalized.hits.map((hit, index) => (
                  <tr key={`${hit.pdbChain}-${index}`}>
                    <td>{hit.rank ?? "—"}</td>
                    <td>{hit.pdbChain ?? "—"}</td>
                    <td>{hit.zScore ?? "—"}</td>
                    <td>{hit.rmsd ?? "—"}</td>
                    <td>{hit.alignLength ?? "—"}</td>
                    <td>{hit.identityPct ?? "—"}</td>
                    <td>{hit.description ?? "—"}</td>
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
