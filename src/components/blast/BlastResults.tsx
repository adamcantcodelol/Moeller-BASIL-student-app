import type { BlastNormalizedSearch } from "@/adapters/blast";
import { DataCollapse } from "@/components/ui/DataCollapse";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

export function BlastResults({
  normalized,
  jobs,
}: {
  normalized: BlastNormalizedSearch | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;
  const running =
    latestJob?.status === "running" || latestJob?.status === "queued";
  const rid =
    typeof latestJob?.parameters?.rid === "string"
      ? latestJob.parameters.rid
      : null;

  if (!normalized) {
    return (
      <div className="card">
        <EmptyScientificPanel
          title="Normalized BLAST hits"
          message={
            running
              ? `NCBI BLAST is still running${rid ? ` (RID ${rid})` : ""} — usually 1–5 minutes, sometimes longer when NCBI is busy. Other results are ready; refresh this page later.`
              : "No BLAST search has completed yet."
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
      <h3>Normalized sequence-similarity hits</h3>
      <p className="muted">
        <strong>
          Method:{" "}
          {normalized.methodLabel ??
            `NCBI BLAST (${normalized.program} vs ${normalized.database})`}
        </strong>
      </p>
      {normalized.method === "rcsb-mmseqs2" ? (
        <p className="muted">
          Fast classroom search of every experimental structure in the PDB with
          MMseqs2 (a BLAST-like algorithm). Near-identical PDB entries are
          grouped at 95% identity so you see diverse homologs. For a full NCBI
          BLAST run, use the BLAST module button below.
        </p>
      ) : null}
      <p className="muted">
        {normalized.method === "rcsb-mmseqs2"
          ? `RCSB query ${normalized.rid}`
          : `RID ${normalized.rid}`}{" "}
        · db {normalized.database} · {normalized.hitCount}{" "}
        hit{normalized.hitCount === 1 ? "" : "s"}
        {normalized.queryLength !== null
          ? ` · query length ${normalized.queryLength}`
          : ""}
      </p>
      <p className="muted">
        Source: {normalized.provenance.source} ·{" "}
        {normalized.provenance.retrievedAt}
      </p>
      {normalized.hits.length === 0 ? (
        <p className="muted">
          The search returned zero hits. That is a real empty result.
        </p>
      ) : (
        <DataCollapse label="Sequence-similarity hit table" count={normalized.hits.length} noun="hits">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Accession</th>
                  <th>Title</th>
                  <th>E-value</th>
                  <th>Bit score</th>
                  <th>Identity %</th>
                  <th>Align len</th>
                </tr>
              </thead>
              <tbody>
                {normalized.hits.map((hit, index) => (
                  <tr key={`${hit.accession ?? "hit"}-${index}`}>
                    <td>{hit.accession ?? hit.hitId ?? "—"}</td>
                    <td>{hit.title ?? "—"}</td>
                    <td>{hit.evalue ?? "—"}</td>
                    <td>{hit.bitScore ?? "—"}</td>
                    <td>{hit.identityPct ?? "—"}</td>
                    <td>{hit.alignmentLength ?? "—"}</td>
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
