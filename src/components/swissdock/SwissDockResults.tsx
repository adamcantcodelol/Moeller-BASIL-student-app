import type { SwissDockNormalizedSearch } from "@/adapters/swissdock";
import { DataCollapse } from "@/components/ui/DataCollapse";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

export function SwissDockResults({
  normalized,
  jobs,
}: {
  normalized: SwissDockNormalizedSearch | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;
  const running =
    latestJob?.status === "running" || latestJob?.status === "queued";

  if (!normalized) {
    return (
      <div className="card">
        <EmptyScientificPanel
          title="Normalized SwissDock results"
          message={
            running
              ? "SwissDock job is still running on the Worker."
              : "No SwissDock run has completed yet. Provide SMILES + box, then Run."
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
      <h3>Normalized SwissDock results</h3>
      <p className="muted">
        Session {normalized.sessionNumber} · PDB {normalized.pdbId} · phase{" "}
        {normalized.phase}
      </p>
      <ul className="docking-choice">
        <li>
          <strong>Ligand:</strong> {normalized.ligand?.name ?? "not recorded"}
          {normalized.ligand?.formula ? ` · ${normalized.ligand.formula}` : ""}
          {normalized.ligand?.id ? ` · ${normalized.ligand.id}` : ""}
          {normalized.ligand ? ` (${normalized.ligand.source})` : ""} ·{" "}
          <code className="smiles">{normalized.smiles}</code>
        </li>
        <li>
          <strong>Docking box:</strong>{" "}
          {normalized.box
            ? `${normalized.box.label} · center ${normalized.box.center.replace(/_/g, ", ")} · size ${normalized.box.size.replace(/_/g, " × ")} Å`
            : "not recorded for this run"}
        </li>
      </ul>
      <p className="muted">
        Source: {normalized.provenance.source} ·{" "}
        {normalized.provenance.retrievedAt}
      </p>
      <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
        {normalized.statusSummary}
      </pre>
      {normalized.poses.length > 0 ? (
        <DataCollapse label="Docking poses (Vina affinity, kcal/mol — more negative = tighter predicted binding)" count={normalized.poses.length} noun="poses">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Affinity / score</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {normalized.poses.map((pose) => (
                  <tr key={pose.rank ?? pose.note}>
                    <td>{pose.rank ?? "—"}</td>
                    <td>{pose.affinity ?? "—"}</td>
                    <td>{pose.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCollapse>
      ) : (
        <p className="muted">
          Status text stored with provenance. Parsed pose affinities appear when
          SwissDock reports them in checkstatus output.
        </p>
      )}
    </div>
  );
}
