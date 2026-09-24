import type { CleanNormalizedResult } from "@/adapters/clean";
import type { ScientificJob } from "@/types/scientificJob";

/**
 * EC predictions exactly as CLEAN returned them. Confidence levels use the
 * official CLEAN web app thresholds (≥0.8 High, 0.2–0.8 Medium, <0.2 Low).
 */
export function CleanResults({
  normalized,
  jobs,
}: {
  normalized: CleanNormalizedResult | null;
  jobs: ScientificJob[];
}) {
  const latestJob = jobs[0] ?? null;
  return (
    <section className="card">
      <h3>CLEAN EC predictions</h3>
      {!normalized ? (
        <p className="muted">
          No CLEAN predictions stored yet. Run live CLEAN above or import a
          CLEAN CSV. EC numbers are never invented.
        </p>
      ) : (
        <>
          <p className="muted">
            {normalized.kind === "clean-import"
              ? "From an imported CLEAN CSV"
              : "Live from UIUC MoleculeMaker CLEAN"}{" "}
            · sequence <code>{normalized.header}</code>
            {normalized.sequenceLength
              ? ` (${normalized.sequenceLength} aa)`
              : ""}
            {normalized.mmliJobId ? (
              <>
                {" "}
                · job <code>{normalized.mmliJobId}</code>
              </>
            ) : null}
          </p>
          {normalized.predictions.length === 0 ? (
            <p>CLEAN returned no EC prediction for this sequence.</p>
          ) : (
            <table className="clean-predictions">
              <thead>
                <tr>
                  <th>EC number</th>
                  <th>Enzyme</th>
                  <th>Confidence score</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {normalized.predictions.map((prediction) => (
                  <tr key={prediction.ecNumber}>
                    <td>
                      {prediction.expasyUrl ? (
                        <a
                          href={prediction.expasyUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          EC {prediction.ecNumber}
                        </a>
                      ) : (
                        `EC ${prediction.ecNumber}`
                      )}
                    </td>
                    <td>
                      {prediction.enzymeName ?? "—"}
                      {prediction.enzymeClass ? (
                        <span className="muted">
                          {" "}
                          · class: {prediction.enzymeClass}
                        </span>
                      ) : null}
                    </td>
                    <td>{prediction.score.toFixed(4)}</td>
                    <td
                      className={`clean-level-${prediction.level.toLowerCase()}`}
                    >
                      {prediction.level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted provenance-line">
            Provenance: {normalized.provenance.source} ·{" "}
            {normalized.provenance.retrievedAt}. Levels: High ≥ 0.8 · Medium
            0.2–0.8 · Low &lt; 0.2 (CLEAN web app thresholds).
          </p>
        </>
      )}
      {latestJob?.status === "failed" && latestJob.error ? (
        <p className="error">Last CLEAN job failed: {latestJob.error}</p>
      ) : null}
    </section>
  );
}
