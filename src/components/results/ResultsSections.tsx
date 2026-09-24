import Link from "next/link";
import type { ToolResultSection } from "@/lib/services/pipelineService";
import type { SpriteNormalizedSearch } from "@/adapters/sprite";
import { SpriteResults } from "@/components/sprite/SpriteResults";
import { BlastResults } from "@/components/blast/BlastResults";
import { FoldseekResults } from "@/components/foldseek/FoldseekResults";
import { DaliResults } from "@/components/dali/DaliResults";
import { InterProResults } from "@/components/interpro/InterProResults";
import { SwissDockResults } from "@/components/swissdock/SwissDockResults";
import { LabExplainer } from "@/components/module/LabExplainer";
import { CleanResults } from "@/components/clean/CleanResults";
import { RunCleanButton } from "@/components/clean/RunCleanButton";
import { RetryStepButton } from "@/components/pipeline/RetryStepButton";
import type { CleanNormalizedResult } from "@/adapters/clean";
import type { BlastNormalizedSearch } from "@/adapters/blast";
import type { FoldseekNormalizedSearch } from "@/adapters/foldseek";
import type { DaliNormalizedSearch } from "@/adapters/dali";
import type { InterProNormalizedAnnotation } from "@/adapters/interpro";
import type { SwissDockNormalizedSearch } from "@/adapters/swissdock";
import type { Evidence } from "@/types/evidence";
import { DataCollapse } from "@/components/ui/DataCollapse";
import { ExpandAllControl } from "@/components/results/ExpandAllControl";
import { buildResultSummaryLine, defaultPanelOpen } from "@/lib/results/summaryLine";

function StatusBadge({ status }: { status: ToolResultSection["status"] }) {
  return (
    <span className={`result-status result-status-${status}`}>
      {status}
    </span>
  );
}

function ToolDeepBody({ section }: { section: ToolResultSection }) {
  if (!section.normalized) {
    return null;
  }
  if (section.tool === "sprite") {
    // Preserve RMSD ascending / band grouping from SpriteResults.
    return (
      <SpriteResults
        normalized={section.normalized as SpriteNormalizedSearch}
        jobs={[]}
      />
    );
  }
  if (section.tool === "blast") {
    return (
      <BlastResults
        normalized={section.normalized as BlastNormalizedSearch}
        jobs={[]}
      />
    );
  }
  if (section.tool === "foldseek") {
    return (
      <FoldseekResults
        normalized={section.normalized as FoldseekNormalizedSearch}
        jobs={[]}
      />
    );
  }
  if (section.tool === "dali") {
    return (
      <DaliResults
        normalized={section.normalized as DaliNormalizedSearch}
        jobs={[]}
      />
    );
  }
  if (section.tool === "interpro") {
    return (
      <InterProResults
        normalized={section.normalized as InterProNormalizedAnnotation}
        jobs={[]}
      />
    );
  }
  if (section.tool === "clean") {
    return (
      <CleanResults
        normalized={section.normalized as CleanNormalizedResult}
        jobs={[]}
      />
    );
  }
  if (section.tool === "swissdock") {
    return (
      <SwissDockResults
        normalized={section.normalized as SwissDockNormalizedSearch}
        jobs={[]}
      />
    );
  }
  if (section.tool === "rcsb") {
    const data = section.normalized as {
      pdbId?: string;
      title?: string | null;
      organism?: string | null;
      chains?: string[] | null;
      uniprotAccessions?: string[];
    };
    return (
      <ul>
        <li>PDB: {data.pdbId}</li>
        {data.title ? <li>Title: {data.title}</li> : null}
        {data.organism ? <li>Organism: {data.organism}</li> : null}
        {data.chains?.length ? (
          <li>Chains: {data.chains.join(", ")}</li>
        ) : null}
        {data.uniprotAccessions?.length ? (
          <li>UniProt: {data.uniprotAccessions.join(", ")}</li>
        ) : (
          <li className="muted">No UniProt mapping in stored metadata.</li>
        )}
      </ul>
    );
  }
  return null;
}

function EvidencePanel({
  projectId,
  evidence,
}: {
  projectId: string;
  evidence: Evidence[];
}) {
  const modules = new Set(evidence.map((item) => item.sourceModuleId).filter(Boolean));
  const line =
    evidence.length === 0
      ? "No evidence residues recorded yet."
      : `${evidence.length} record${evidence.length === 1 ? "" : "s"} from ${modules.size} module${modules.size === 1 ? "" : "s"}`;
  return (
    <details className="card result-section result-panel" id="result-evidence">
      <summary className="result-panel-summary">
        <span className="result-panel-title">
          <strong>Active-site evidence</strong>{" "}
          <span className={`result-status result-status-${evidence.length ? "succeeded" : "empty"}`}>
            {evidence.length ? "recorded" : "empty"}
          </span>
        </span>
        <span className="result-panel-line muted">{line}</span>
      </summary>
      <p>
        <Link href={`/projects/${projectId}/modules/active-site-evidence`}>
          Open Active-Site Evidence Synthesis
        </Link>
      </p>
      {evidence.length > 0 ? (
        <DataCollapse label="Evidence table" count={evidence.length} noun="records">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Residue</th>
                  <th>Module</th>
                  <th>Strength</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => {
                  const residue = item.residues?.[0];
                  return (
                    <tr key={item.id}>
                      <td>
                        {residue
                          ? `${residue.chain ? `${residue.chain}:` : ""}${residue.position}${residue.aminoAcid ? ` (${residue.aminoAcid})` : ""}`
                          : "—"}
                      </td>
                      <td>{item.sourceModuleId ?? "—"}</td>
                      <td>{item.strength ?? "—"}</td>
                      <td>{item.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataCollapse>
      ) : null}
    </details>
  );
}

export function ResultsSections({
  projectId,
  sections,
  hasSequence,
  evidence,
}: {
  projectId: string;
  sections: ToolResultSection[];
  hasSequence: boolean;
  evidence?: Evidence[];
}) {
  return (
    <div className="results-sections" id="results-panels">
      <ExpandAllControl targetId="results-panels" />
      {sections.map((section, index) => (
        <details
          key={section.tool}
          className="card result-section result-panel"
          id={`result-${section.tool}`}
          open={defaultPanelOpen(section, index)}
        >
          <summary className="result-panel-summary">
            <span className="result-panel-title">
              <strong>{section.label}</strong> <StatusBadge status={section.status} />
            </span>
            <span className="result-panel-line muted">
              {buildResultSummaryLine(section)}
            </span>
          </summary>
          <p>
            <Link href={`/projects/${projectId}/modules/${section.moduleSlug}`}>
              Open module page
            </Link>
          </p>
          <LabExplainer labKey={section.tool} />
          <p>{section.summary}</p>
          {section.provenanceSource ? (
            <p className="muted provenance-line">
              Provenance: {section.provenanceSource}
              {section.provenanceRetrievedAt
                ? ` · ${section.provenanceRetrievedAt}`
                : ""}
            </p>
          ) : (
            <p className="muted">
              No provenance stored for this section (empty, skipped, or failed
              honestly).
            </p>
          )}
          {section.skipReason ? (
            <p className="muted">Skip reason: {section.skipReason}</p>
          ) : null}
          {section.error ? <p className="error">{section.error}</p> : null}
          {section.status === "unavailable" && section.tool !== "rcsb" ? (
            <p>
              <RetryStepButton projectId={projectId} tool={section.tool} />{" "}
              <Link
                href={`/projects/${projectId}/modules/${section.moduleSlug}`}
              >
                or import a CSV
              </Link>
            </p>
          ) : null}
          {section.tool === "clean" ? (
            <RunCleanButton projectId={projectId} hasSequence={hasSequence} />
          ) : null}
          <ToolDeepBody section={section} />
        </details>
      ))}
      {evidence ? <EvidencePanel projectId={projectId} evidence={evidence} /> : null}
    </div>
  );
}
