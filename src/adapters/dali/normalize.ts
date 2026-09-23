import { buildProvenance } from "@/lib/provenance/buildProvenance";
import { nowIso } from "@/lib/ids";
import type { Provenance } from "@/types/provenance";
import {
  DALI_PROVENANCE_SOURCE,
  type DaliHitNormalized,
  type DaliNormalizedSearch,
  type DaliRawPayload,
} from "@/adapters/dali/types";

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse Dali summary text. Typical header:
 *   No:  Chain   Z    rmsd lali nres  %id PDB  Description
 * Never invents Z-scores — only parses lines that match the table.
 */
export function parseDaliSummaryText(text: string): DaliHitNormalized[] {
  const hits: DaliHitNormalized[] = [];
  const lines = text.split(/\r?\n/);
  let inTable = false;
  for (const line of lines) {
    if (/^\s*#?\s*No:\s+Chain/i.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && line.trim() === "") {
      continue;
    }
    if (inTable && /^\s*#/.test(line) && hits.length > 0) {
      break;
    }
    if (inTable && /^\s*#/.test(line)) {
      continue;
    }
    if (!inTable) continue;
    // e.g. "  1:  1crn-A 37.1  0.0  46   46  100   1crn  DESCRIPTION..."
    const match = line.match(
      /^\s*(\d+):\s+(\S+)\s+([0-9.]+)\s+([0-9.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/,
    );
    if (!match) {
      // Alternative without trailing PDB code column duplicated
      const alt = line.match(
        /^\s*(\d+):\s+(\S+)\s+([0-9.]+)\s+([0-9.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/,
      );
      if (!alt) continue;
      hits.push({
        rank: parseNumber(alt[1]),
        pdbChain: alt[2] ?? null,
        zScore: parseNumber(alt[3]),
        rmsd: parseNumber(alt[4]),
        alignLength: parseNumber(alt[5]),
        nRes: parseNumber(alt[6]),
        identityPct: parseNumber(alt[7]),
        description: (alt[8] ?? "").trim() || null,
      });
      continue;
    }
    hits.push({
      rank: parseNumber(match[1]),
      pdbChain: match[2] ?? null,
      zScore: parseNumber(match[3]),
      rmsd: parseNumber(match[4]),
      alignLength: parseNumber(match[5]),
      nRes: parseNumber(match[6]),
      identityPct: parseNumber(match[7]),
      description: [match[8], match[9]].filter(Boolean).join(" ").trim() || null,
    });
  }
  return hits;
}

export function buildDaliProvenance(input: {
  pdbId: string;
  chain: string;
  jobUrl: string;
  status: string;
  hitCount?: number | null;
  retrievedAt?: string;
}): Provenance {
  return buildProvenance({
    tool: "Dali",
    source: DALI_PROVENANCE_SOURCE,
    retrievedAt: input.retrievedAt ?? nowIso(),
    parameters: {
      pdbId: input.pdbId,
      chain: input.chain,
      jobUrl: input.jobUrl,
      status: input.status,
      hitCount: input.hitCount ?? null,
      api: DALI_PROVENANCE_SOURCE,
    },
    version: "ekhidna2 dump.cgi PDB search",
  });
}

export function normalizeDaliPayload(
  output: DaliRawPayload,
  options?: { retrievedAt?: string; provenance?: Provenance },
): DaliNormalizedSearch {
  const retrievedAt = options?.retrievedAt ?? nowIso();
  const hits =
    output.status === "READY" && output.summaryText
      ? parseDaliSummaryText(output.summaryText)
      : [];
  const provenance =
    options?.provenance ??
    buildDaliProvenance({
      pdbId: output.pdbId,
      chain: output.chain,
      jobUrl: output.jobUrl,
      status: output.status,
      hitCount: hits.length,
      retrievedAt,
    });
  return {
    pdbId: output.pdbId,
    chain: output.chain,
    jobUrl: output.jobUrl,
    status: output.status,
    hitCount: hits.length,
    hits,
    provenance,
  };
}
