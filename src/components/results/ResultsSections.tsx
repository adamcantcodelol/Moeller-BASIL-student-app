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

export function ResultsSections({
  projectId,
  sections,
  hasSequence,
}: {
  projectId: string;
  sections: ToolResultSection[];
  hasSequence: boolean;
}) {
  return (
    <div className="results-sections">
      {sections.map((section) => (
        <section
          key={section.tool}
          className="card result-section"
          id={`result-${section.tool}`}
        >
          <header className="result-section-header">
            <h2>
              {section.label} <StatusBadge status={section.status} />
            </h2>
            <Link href={`/projects/${projectId}/modules/${section.moduleSlug}`}>
              Open module page
            </Link>
          </header>
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
        </section>
      ))}
    </div>
  );
}
