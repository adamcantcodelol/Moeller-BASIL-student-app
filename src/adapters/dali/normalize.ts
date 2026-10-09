import { buildProvenance } from "@/lib/provenance/buildProvenance";
import { nowIso } from "@/lib/ids";
import type { Provenance } from "@/types/provenance";
import {
  DALI_PROVENANCE_SOURCE,
  type DaliAlignedSegment,
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

/** Keep only this many best hits (by Z-score) so results stay small in D1. */
export const DALI_KEEP_TOP = 25;

const EQUIV_RE =
  /^\s*(\d+):\s+(\S+)\s+(\S+)\s+(-?\d+)\s*-\s*(-?\d+)\s+<=>\s+(-?\d+)\s*-\s*(-?\d+)\s+\(\s*(\w{3})\s+(-?\d+)\s*-\s*(\w{3})\s+(-?\d+)\s*<=>\s*(\w{3})\s+(-?\d+)\s*-\s*(\w{3})\s+(-?\d+)\s*\)/;

/** Parse "# Structural equivalences" lines, keyed by hit number. Lines that don't match are skipped. */
export function parseDaliEquivalences(text: string): Map<number, DaliAlignedSegment[]> {
  const out = new Map<number, DaliAlignedSegment[]>();
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#\s*Structural equivalences/i.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^\s*#/.test(line)) break;
    const m = line.match(EQUIV_RE);
    if (!m) continue;
    const n = (i: number) => Number(m[i]);
    const seg: DaliAlignedSegment = {
      querySeq: [n(4), n(5)],
      hitSeq: [n(6), n(7)],
      queryRes: [m[8], m[10]],
      query: [n(9), n(11)],
      hitRes: [m[12], m[14]],
      hit: [n(13), n(15)],
    };
    const list = out.get(n(1)) ?? [];
    list.push(seg);
    out.set(n(1), list);
  }
  return out;
}

/** Best hits first (Z-score desc), trimmed to `keep`, with their aligned segments attached. */
export function selectTopDaliHits(text: string, keep = DALI_KEEP_TOP): { total: number; hits: DaliHitNormalized[] } {
  const all = parseDaliSummaryText(text);
  const equivalences = parseDaliEquivalences(text);
  const top = [...all]
    .sort((a, b) => (b.zScore ?? -Infinity) - (a.zScore ?? -Infinity))
    .slice(0, keep)
    .map((hit) => {
      const segs = hit.rank !== null ? equivalences.get(hit.rank) : undefined;
      return segs?.length ? { ...hit, alignedSegments: segs } : hit;
    });
  return { total: all.length, hits: top };
}

/** Raw payload trimmed to the kept hits' summary + equivalence lines (drops the multi-MB remainder). */
export function trimDaliRawPayload(raw: DaliRawPayload, kept: DaliHitNormalized[]): DaliRawPayload & { trimmedToTop?: number } {
  if (!raw.summaryText) return { ...raw, indexHtml: null };
  const ranks = new Set(kept.map((h) => h.rank).filter((r): r is number => r !== null));
  let block: "head" | "summary" | "equiv" | "other" = "head";
  const lines: string[] = [];
  for (const line of raw.summaryText.split(/\r?\n/)) {
    if (/^\s*#\s*Structural equivalences/i.test(line)) block = "equiv";
    else if (/^\s*#?\s*No:\s+Chain/i.test(line)) block = "summary";
    else if (/^\s*#\s*(Pairwise|Translation)/i.test(line)) block = "other";
    if (/^\s*#/.test(line)) {
      if (block !== "other") lines.push(line);
      continue;
    }
    if (block === "head") lines.push(line);
    else if (block === "summary" || block === "equiv") {
      const no = line.match(/^\s*(\d+):/);
      if (no && ranks.has(Number(no[1]))) lines.push(line);
    }
  }
  return { ...raw, summaryText: lines.join("\n"), indexHtml: null, trimmedToTop: kept.length };
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
  const { total, hits } =
    output.status === "READY" && output.summaryText
      ? selectTopDaliHits(output.summaryText)
      : { total: 0, hits: [] as DaliHitNormalized[] };
  const provenance =
    options?.provenance ??
    buildDaliProvenance({
      pdbId: output.pdbId,
      chain: output.chain,
      jobUrl: output.jobUrl,
      status: output.status,
      hitCount: total,
      retrievedAt,
    });
  return {
    pdbId: output.pdbId,
    chain: output.chain,
    jobUrl: output.jobUrl,
    status: output.status,
    hitCount: total,
    hits,
    keptTop: DALI_KEEP_TOP,
    provenance,
  };
}
