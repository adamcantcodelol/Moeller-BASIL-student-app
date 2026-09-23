import type { PdbStructure } from "@/types/structure";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";
import { FetchRcsbButton } from "@/components/pdb/FetchRcsbButton";

function metadataString(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!metadata) {
    return null;
  }
  const value = metadata[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function metadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!metadata) {
    return null;
  }
  const value = metadata[key];
  return typeof value === "number" ? value : null;
}

export function StructureRecord({
  projectId,
  structure,
}: {
  projectId: string;
  structure: PdbStructure | null;
}) {
  if (!structure) {
    return (
      <EmptyScientificPanel
        title="Structure record"
        message="No PDB identifier has been saved for this project."
      />
    );
  }

  const retrieved = structure.source === "rcsb" && Boolean(structure.retrievedAt);
  const method = metadataString(structure.metadata, "experimentalMethod");
  const resolution = metadataNumber(structure.metadata, "resolutionAngstrom");
  const entryPageUrl = metadataString(structure.metadata, "entryPageUrl");
  const provenance = structure.metadata?.provenance;

  return (
    <section className="card">
      <h3>Structure record</h3>
      <p>
        <strong>PDB ID:</strong> {structure.pdbId}
      </p>
      <p>
        <strong>Source:</strong> {structure.source}
      </p>
      {!retrieved ? (
        <p className="muted">
          Identifier is stored. Title, organism, chains, and sequence remain
          empty until a verified RCSB fetch succeeds. Empty fields are never
          filled with guessed values.
        </p>
      ) : (
        <p className="muted">
          Metadata retrieved from the RCSB PDB Data API. Coordinates for Mol*
          are loaded from files.rcsb.org at view time.
        </p>
      )}
      <dl>
        <dt>Title</dt>
        <dd>{structure.title ?? "not retrieved"}</dd>
        <dt>Organism</dt>
        <dd>{structure.organism ?? "not retrieved"}</dd>
        <dt>Chains</dt>
        <dd>
          {structure.chains && structure.chains.length > 0
            ? structure.chains.join(", ")
            : "not retrieved"}
        </dd>
        <dt>Sequence (first polymer entity)</dt>
        <dd className="sequence-block">
          {structure.sequence ?? "not retrieved"}
        </dd>
        <dt>Experimental method</dt>
        <dd>{method ?? "not retrieved"}</dd>
        <dt>Resolution (Å)</dt>
        <dd>
          {resolution !== null ? resolution.toFixed(2) : "not retrieved"}
        </dd>
        <dt>Retrieved at</dt>
        <dd>{structure.retrievedAt ?? "not retrieved"}</dd>
        <dt>RCSB entry</dt>
        <dd>
          {entryPageUrl ? (
            <a href={entryPageUrl} target="_blank" rel="noreferrer">
              {entryPageUrl}
            </a>
          ) : (
            "not retrieved"
          )}
        </dd>
      </dl>
      {provenance && typeof provenance === "object" ? (
        <details>
          <summary>Provenance</summary>
          <pre className="provenance-block">
            {JSON.stringify(provenance, null, 2)}
          </pre>
        </details>
      ) : null}
      <FetchRcsbButton
        projectId={projectId}
        pdbId={structure.pdbId}
        disabled={false}
      />
    </section>
  );
}
