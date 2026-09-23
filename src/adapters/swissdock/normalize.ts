import { buildProvenance } from "@/lib/provenance/buildProvenance";
import { nowIso } from "@/lib/ids";
import type { Provenance } from "@/types/provenance";
import {
  SWISSDOCK_PROVENANCE_SOURCE,
  type SwissDockNormalizedSearch,
  type SwissDockPoseNormalized,
  type SwissDockRawPayload,
} from "@/adapters/swissdock/types";

/** Parse affinity-looking lines from checkstatus/retrieve text without inventing poses. */
export function parseSwissDockStatusText(
  text: string,
): SwissDockPoseNormalized[] {
  const poses: SwissDockPoseNormalized[] = [];
  const lines = text.split(/\r?\n/);
  let rank = 0;
  for (const line of lines) {
    const match = line.match(
      /(?:affinity|energy|score)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i,
    );
    if (!match) continue;
    rank += 1;
    poses.push({
      rank,
      affinity: Number(match[1]),
      note: line.trim().slice(0, 200),
    });
  }
  return poses;
}

export function buildSwissDockProvenance(input: {
  sessionNumber: string;
  pdbId: string;
  smiles: string;
  phase: string;
  retrievedAt?: string;
}): Provenance {
  return buildProvenance({
    tool: "SwissDock",
    source: SWISSDOCK_PROVENANCE_SOURCE,
    retrievedAt: input.retrievedAt ?? nowIso(),
    parameters: {
      sessionNumber: input.sessionNumber,
      pdbId: input.pdbId,
      smiles: input.smiles,
      phase: input.phase,
      api: "https://swissdock.ch:8443",
      method: "Vina",
    },
    version: "SwissDock CLI REST (Vina)",
  });
}

export function normalizeSwissDockPayload(
  output: SwissDockRawPayload,
  options?: { retrievedAt?: string; provenance?: Provenance },
): SwissDockNormalizedSearch {
  const retrievedAt = options?.retrievedAt ?? nowIso();
  const poses =
    output.phase === "ready" && output.resultsText
      ? parseSwissDockStatusText(output.resultsText)
      : [];
  const provenance =
    options?.provenance ??
    buildSwissDockProvenance({
      sessionNumber: output.sessionNumber,
      pdbId: output.pdbId,
      smiles: output.smiles,
      phase: output.phase,
      retrievedAt,
    });
  return {
    sessionNumber: output.sessionNumber,
    pdbId: output.pdbId,
    smiles: output.smiles,
    phase: output.phase,
    poseCount: poses.length,
    poses,
    statusSummary: output.statusText.slice(0, 2000),
    provenance,
  };
}
