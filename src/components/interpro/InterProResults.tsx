import type { InterProNormalizedAnnotation } from "@/adapters/interpro";
import { DataCollapse } from "@/components/ui/DataCollapse";
import type { ScientificJob } from "@/types/scientificJob";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

export function InterProResults({
  normalized,
  jobs,
}: {
  normalized: InterProNormalizedAnnotation | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;

  if (!normalized) {
    return (
      <div className="card">
        <EmptyScientificPanel
          title="Normalized InterPro annotations"
          message="No InterPro annotations have been retrieved yet. Enter a UniProt accession above, or use the import fallback if the API is unavailable."
        />
        {latestJob?.status === "failed" && latestJob.error ? (
          <p className="error">Last job failed: {latestJob.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Normalized InterPro annotations</h3>
      <p>
        <strong>{normalized.uniprotAccession}</strong>
        {normalized.proteinId ? ` (${normalized.proteinId})` : ""}
        {normalized.proteinName ? ` — ${normalized.proteinName}` : ""}
      </p>
      <p className="muted">
        {[
          normalized.organism,
          normalized.length !== null ? `${normalized.length} aa` : null,
          `${normalized.entryCount} InterPro entr${normalized.entryCount === 1 ? "y" : "ies"}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="muted">
        Source: {normalized.provenance.source} · retrieved{" "}
        {normalized.provenance.retrievedAt} ·{" "}
        <a href={normalized.proteinPageUrl} target="_blank" rel="noreferrer">
          Open on InterPro
        </a>
      </p>

      {normalized.entries.length === 0 ? (
        <p className="muted">
          InterPro returned zero matching entries for this accession. That is a
          real empty result, not fabricated data.
        </p>
      ) : (
        <DataCollapse label="InterPro entries (domains, families, sites)" count={normalized.entries.length} noun="entries">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Accession</th>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Locations</th>
                  <th>GO terms</th>
                </tr>
              </thead>
              <tbody>
                {normalized.entries.map((entry) => (
                  <tr key={entry.accession}>
                    <td>
                      <a
                        href={`https://www.ebi.ac.uk/interpro/entry/InterPro/${entry.accession}/`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {entry.accession}
                      </a>
                    </td>
                    <td>{entry.type}</td>
                    <td>{entry.name}</td>
                    <td>
                      {entry.locations.length === 0
                        ? "—"
                        : entry.locations
                            .map((loc) => `${loc.start}–${loc.end}`)
                            .join(", ")}
                    </td>
                    <td>
                      {entry.goTerms.length === 0
                        ? "—"
                        : entry.goTerms
                            .slice(0, 3)
                            .map((term) => term.id)
                            .join(", ")}
                      {entry.goTerms.length > 3
                        ? ` (+${entry.goTerms.length - 3})`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCollapse>
      )}

      <EmptyScientificPanel
        title="Interpretation"
        message="Interpretation is not generated automatically. Record your own observations below."
      />
      <EmptyScientificPanel
        title="Evidence"
        message="Domain hits are stored as scientific results with provenance. Active-site residues are not inferred from InterPro alone."
      />
    </div>
  );
}
