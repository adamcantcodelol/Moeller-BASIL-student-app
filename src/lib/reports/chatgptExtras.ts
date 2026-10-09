import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { results } from "@/db/schema";
import type { ToolResultSection } from "@/lib/services/pipelineService";
import { chainResidues, fetchRcsbPdbText, oneLetter, parsePdbAtoms } from "@/lib/structure/pdbAtoms";
import type { Evidence } from "@/types/evidence";

/** Residue-level extras for the ChatGPT export, derived only from stored data + real coordinates. */

export interface CandidateResidue {
  chain: string | null;
  resNo: string;
  /** One-letter code when known. */
  aa: string | null;
  label: string;
  sources: string[];
}

export interface AlignmentRow {
  candidate: string;
  target: string | null; // null = aligned to a gap / outside alignment
  identical: boolean | null;
}

export interface FoldseekCandidateMap {
  target: string;
  eValue: number | null;
  seqId: number | null;
  targetNumbering: "author" | "foldseek-index";
  rows: AlignmentRow[];
}

export interface InterProCheck {
  uniprot: string;
  numberingMatches: boolean;
  detail: string;
}

export interface ExportExtras {
  candidates: CandidateResidue[];
  foldseekMaps: FoldseekCandidateMap[];
  foldseekNote: string | null;
  interpro: InterProCheck | null;
}

type Res = { chain?: string | null; resNo?: string | null; resType?: string | null };

function toOne(aa: string | null | undefined): string | null {
  if (!aa) return null;
  const t = aa.trim();
  if (t.length === 1) return t.toUpperCase();
  const one = oneLetter(t);
  return one === "X" ? null : one;
}

export function candidateLabel(c: { chain: string | null; resNo: string; aa: string | null }): string {
  const three = c.aa ? Object.entries({ A: "ALA", R: "ARG", N: "ASN", D: "ASP", C: "CYS", Q: "GLN", E: "GLU", G: "GLY", H: "HIS", I: "ILE", L: "LEU", K: "LYS", M: "MET", F: "PHE", P: "PRO", S: "SER", T: "THR", W: "TRP", Y: "TYR", V: "VAL" }).find(([k]) => k === c.aa)?.[1] : null;
  return `${three ?? c.aa ?? "?"}${c.resNo}${c.chain ? `(${c.chain})` : ""}`;
}

/** Candidate active-site residues: matched residues of the 3 best SPRITE hits + student evidence residues. */
export function candidateResidues(sections: ToolResultSection[], evidence: Evidence[]): CandidateResidue[] {
  const byKey = new Map<string, CandidateResidue>();
  const add = (chain: string | null, resNo: string, aa: string | null, source: string) => {
    const key = `${chain ?? ""}:${resNo}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      if (!existing.aa && aa) existing.aa = aa;
      return;
    }
    byKey.set(key, { chain, resNo, aa, label: "", sources: [source] });
  };
  const sprite = sections.find((s) => s.tool === "sprite" && s.status === "succeeded");
  const hits = ((sprite?.normalized as { hits?: Array<{ rmsd: number | null; pdbId: string; matchResidues?: Res[] }> } | null)?.hits ?? [])
    .filter((h) => typeof h.rmsd === "number")
    .sort((a, b) => (a.rmsd as number) - (b.rmsd as number))
    .slice(0, 3);
  for (const hit of hits) {
    for (const r of hit.matchResidues ?? []) {
      if (r.resNo) add(r.chain ?? null, r.resNo, toOne(r.resType), `SPRITE match to ${hit.pdbId} (RMSD ${hit.rmsd})`);
    }
  }
  for (const e of evidence) {
    for (const r of e.residues ?? []) add(r.chain ?? null, String(r.position), toOne(r.aminoAcid), `student evidence (${e.sourceModuleId ?? "unknown"})`);
  }
  return [...byKey.values()].slice(0, 12).map((c) => ({ ...c, label: candidateLabel(c) }));
}

/** Map query sequence index (1-based) → aligned target index (1-based) from a Foldseek alignment. */
export function alignmentIndexMap(qAln: string, dbAln: string, qStart: number, dbStart: number): Map<number, number | null> {
  const map = new Map<number, number | null>();
  let qi = qStart;
  let ti = dbStart;
  for (let k = 0; k < Math.min(qAln.length, dbAln.length); k++) {
    const q = qAln[k];
    const t = dbAln[k];
    if (q !== "-" && t !== "-") map.set(qi, ti);
    else if (q !== "-") map.set(qi, null);
    if (q !== "-") qi++;
    if (t !== "-") ti++;
  }
  return map;
}

/** Author numbering for a Foldseek sequence, only if the structure's residues reproduce it exactly. */
function verifiedNumbering(residues: { resNo: string; resName: string }[], sequence: string): string[] | null {
  const seq = residues.map((r) => oneLetter(r.resName)).join("");
  const offset = seq.indexOf(sequence);
  if (!sequence || offset < 0) return null;
  return residues.slice(offset, offset + sequence.length).map((r) => r.resNo);
}

async function loadRaw(db: AppDatabase, section: ToolResultSection | undefined): Promise<Record<string, unknown> | null> {
  const rawId = (section?.normalized as { provenance?: { rawResultId?: string | null } } | null)?.provenance?.rawResultId;
  if (!rawId) return null;
  const rows = await db.select().from(results).where(eq(results.id, rawId));
  try {
    return rows[0]?.rawDataJson ? (JSON.parse(rows[0].rawDataJson) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type FoldseekAln = {
  query: string; target: string; qAln: string; dbAln: string; qStartPos: number; dbStartPos: number;
  eval?: number; seqId?: number; tSeq?: string;
};

export async function loadExportExtras(
  db: AppDatabase,
  input: { pdbId: string | null; sections: ToolResultSection[]; evidence: Evidence[] },
  fetchImpl: typeof fetch = fetch,
): Promise<ExportExtras> {
  const candidates = candidateResidues(input.sections, input.evidence);
  const extras: ExportExtras = { candidates, foldseekMaps: [], foldseekNote: null, interpro: null };
  if (!candidates.length) return extras;

  // InterPro: does UniProt numbering match the PDB numbering at the candidate positions?
  const interproRaw = await loadRaw(db, input.sections.find((s) => s.tool === "interpro" && s.status === "succeeded"));
  const meta = (interproRaw?.protein as { metadata?: { accession?: string; sequence?: string } } | undefined)?.metadata;
  if (meta?.sequence && meta.accession) {
    const checked = candidates.filter((c) => c.aa);
    const mismatches = checked.filter((c) => {
      const pos = Number.parseInt(c.resNo, 10);
      return !(pos >= 1 && meta.sequence!.charAt(pos - 1) === c.aa);
    });
    extras.interpro = {
      uniprot: meta.accession,
      numberingMatches: checked.length > 0 && mismatches.length === 0,
      detail: checked.length === 0
        ? "No candidate residue types known, so numbering was not checked."
        : mismatches.length === 0
          ? `UniProt ${meta.accession} has the same amino acid at every candidate position (${checked.map((c) => c.label).join(", ")}), so PDB and UniProt numbering agree here.`
          : `UniProt ${meta.accession} sequence differs at ${mismatches.map((c) => c.label).join(", ")}, so PDB and UniProt numbering may be offset; this file does not say whether candidates fall inside InterPro ranges.`,
    };
  }

  // Foldseek: which residues of the top non-self hits align to the candidates?
  const foldseekRaw = await loadRaw(db, input.sections.find((s) => s.tool === "foldseek" && s.status === "succeeded"));
  const result = foldseekRaw?.result as { queries?: { sequence?: string }[]; results?: { alignments?: unknown[] }[] } | undefined;
  if (!result?.results?.length || !input.pdbId) {
    extras.foldseekNote = foldseekRaw ? "Foldseek alignments were not found in the stored result." : "Foldseek alignment details are not stored for this run.";
    return extras;
  }
  const all = result.results.flatMap((r) => {
    const a = r.alignments ?? [];
    return (Array.isArray(a[0]) ? (a as unknown[][]).flat() : a) as FoldseekAln[];
  });
  const self = input.pdbId.toLowerCase();
  const top = all
    .filter((a) => a && typeof a.target === "string" && !a.target.toLowerCase().startsWith(self))
    .sort((a, b) => (a.eval ?? Infinity) - (b.eval ?? Infinity))
    .slice(0, 2);
  const querySeq = result.queries?.[0]?.sequence ?? "";
  const queryChain = top[0]?.query.split("_").pop() ?? "A";
  const queryPdb = await fetchRcsbPdbText(input.pdbId, fetchImpl);
  const queryNumbers = queryPdb ? verifiedNumbering(chainResidues(parsePdbAtoms(queryPdb, { protein: true }), queryChain), querySeq) : null;
  if (!queryNumbers) {
    extras.foldseekNote = `Could not match Foldseek's query sequence to ${input.pdbId} residue numbers, so alignments were not mapped.`;
    return extras;
  }
  const indexOfAuthor = new Map(queryNumbers.map((n, i) => [n, i + 1]));

  for (const aln of top) {
    const targetId = aln.target.slice(0, 4);
    const targetChain = aln.target.split(" ")[0].split("_").pop() ?? "";
    const tSeq = aln.tSeq ?? "";
    const targetPdb = /^[0-9][a-z0-9]{3}$/i.test(targetId) ? await fetchRcsbPdbText(targetId, fetchImpl) : null;
    const targetNumbers = targetPdb && tSeq ? verifiedNumbering(chainResidues(parsePdbAtoms(targetPdb, { protein: true }), targetChain), tSeq) : null;
    const map = alignmentIndexMap(aln.qAln, aln.dbAln, aln.qStartPos, aln.dbStartPos);
    const rows: AlignmentRow[] = candidates
      .filter((c) => !c.chain || c.chain === queryChain)
      .map((c) => {
        const qi = indexOfAuthor.get(c.resNo);
        const ti = qi === undefined ? undefined : map.get(qi);
        if (ti === undefined || ti === null) return { candidate: c.label, target: null, identical: null };
        const aa = tSeq.charAt(ti - 1) || "?";
        const num = targetNumbers ? targetNumbers[ti - 1] : `#${ti}`;
        return { candidate: c.label, target: `${aa}${num}`, identical: c.aa ? c.aa === aa : null };
      });
    extras.foldseekMaps.push({
      target: `${targetId}_${targetChain}`,
      eValue: typeof aln.eval === "number" ? aln.eval : null,
      seqId: typeof aln.seqId === "number" ? aln.seqId : null,
      targetNumbering: targetNumbers ? "author" : "foldseek-index",
      rows,
    });
  }
  return extras;
}
