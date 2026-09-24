/**
 * Ligand + docking-box helpers for the SwissDock ligand chooser.
 * Every name, formula and SMILES comes from a real source (the PDB entry,
 * RCSB chemical components, PubChem, Rhea) or is the student's own paste.
 */
import type { AppDatabase } from "@/db/client";
import {
  HET_CATEGORY_LABELS,
  listHetGroups,
  residueCentroid,
  type HetGroup,
  type ResidueRef,
} from "@/adapters/swissdock";
import type { SpriteNormalizedSearch } from "@/adapters/sprite";
import type { CleanNormalizedResult } from "@/adapters/clean";
import { ServiceError } from "@/lib/services/projectService";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { listEvidenceForProject } from "@/lib/services/evidenceService";
import { listSpriteResults } from "@/lib/services/spriteService";
import { listCleanResults } from "@/lib/services/cleanService";
import { validatePdbId } from "@/lib/validation/pdbId";

const LOOKUP_TIMEOUT_MS = 12_000;
const PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const PUBCHEM_PROPS = "Title,MolecularFormula,MolecularWeight,SMILES,IsomericSMILES,CanonicalSMILES";

export interface LigandCandidate {
  source: "structure" | "rcsb-chemcomp" | "pubchem" | "smiles";
  id: string | null;
  name: string;
  formula: string | null;
  smiles: string | null;
  url: string | null;
}

export interface BoxCandidate {
  id: string;
  label: string;
  center: string;
  kind: "structure-ligand" | "evidence" | "sprite" | "residues";
}

export interface StructureHetEntry extends HetGroup {
  categoryLabel: string;
  dockable: boolean;
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

const pdbCache = new Map<string, string>();

export async function fetchPdbText(pdbId: string): Promise<string> {
  const cached = pdbCache.get(pdbId);
  if (cached) return cached;
  const res = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new ServiceError(`Could not download ${pdbId}.pdb from RCSB (HTTP ${res.status}).`, 502);
  }
  const text = await res.text();
  if (pdbCache.size > 20) pdbCache.clear();
  pdbCache.set(pdbId, text);
  return text;
}

async function projectPdbId(db: AppDatabase, projectId: string): Promise<string> {
  const structure = await getStructureByProjectId(db, projectId);
  const validation = validatePdbId(structure?.pdbId ?? "");
  if (!validation.ok) {
    throw new ServiceError("Save a PDB ID in Protein / PDB Setup first.", 400);
  }
  return validation.pdbId;
}

// ---------- SMILES validation (syntax only; never "fixes" input) ----------

export function checkSmilesSyntax(smiles: string): string | null {
  const s = smiles.trim();
  if (s.length < 2) return "Enter a SMILES string (at least 2 characters).";
  if (s.length > 300) return "That SMILES is very long; SwissDock's Vina mode only accepts small ligands.";
  if (/\s/.test(s)) return "SMILES cannot contain spaces.";
  if (!/^[A-Za-z0-9@+\-[\]()=#$:/\\.%*]+$/.test(s)) return "SMILES contains characters that are not valid in SMILES.";
  if (!/[BCNOPSFIbcnops]|Cl|Br/.test(s)) return "SMILES needs at least one atom (e.g. C, N, O).";
  let depth = 0;
  let inBracket = false;
  const rings = new Set<string>();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (inBracket) {
      if (ch === "]") inBracket = false;
      else if (ch === "[") return "Nested [ ] brackets are not valid SMILES.";
      continue;
    }
    if (ch === "[") inBracket = true;
    else if (ch === "]") return "Unmatched ] in SMILES.";
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0) return "Unmatched ) in SMILES.";
    } else if (/\d/.test(ch)) {
      if (rings.has(ch)) rings.delete(ch);
      else rings.add(ch);
    } else if (ch === "%") {
      const pair = s.slice(i + 1, i + 3);
      if (!/^\d\d$/.test(pair)) return "Ring label after % must be two digits.";
      if (rings.has(`%${pair}`)) rings.delete(`%${pair}`);
      else rings.add(`%${pair}`);
      i += 2;
    }
  }
  if (inBracket) return "Unclosed [ in SMILES.";
  if (depth !== 0) return "Unbalanced ( ) in SMILES.";
  if (rings.size > 0) return `Ring bond ${[...rings].join(", ")} is opened but never closed.`;
  return null;
}

interface PubChemProps {
  CID?: number;
  Title?: string;
  MolecularFormula?: string;
  SMILES?: string;
  IsomericSMILES?: string;
  CanonicalSMILES?: string;
}

function pubchemCandidate(p: PubChemProps): LigandCandidate | null {
  const smiles = p.SMILES ?? p.IsomericSMILES ?? p.CanonicalSMILES ?? null;
  if (!p.CID || !smiles) return null;
  return {
    source: "pubchem",
    id: `CID ${p.CID}`,
    name: p.Title ?? `PubChem CID ${p.CID}`,
    formula: p.MolecularFormula ?? null,
    smiles,
    url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,
  };
}

function pubchemRows(body: unknown): PubChemProps[] {
  const table = (body as { PropertyTable?: { Properties?: PubChemProps[] } } | null)?.PropertyTable;
  return table?.Properties ?? [];
}

/** Syntax check, then ask PubChem what the molecule is (name/formula) if known. */
export async function checkSmiles(smiles: string): Promise<{
  ok: boolean;
  error?: string;
  candidate?: LigandCandidate;
  note?: string;
}> {
  const error = checkSmilesSyntax(smiles);
  if (error) return { ok: false, error };
  const trimmed = smiles.trim();
  try {
    const { body } = await fetchJson(`${PUBCHEM}/compound/smiles/property/${PUBCHEM_PROPS}/JSON`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ smiles: trimmed }).toString(),
    });
    const found = pubchemRows(body).map(pubchemCandidate).find(Boolean);
    if (found) {
      // Keep the student's exact SMILES for docking; show PubChem's identity.
      return { ok: true, candidate: { ...found, smiles: trimmed, source: "smiles" } };
    }
    return {
      ok: true,
      candidate: { source: "smiles", id: null, name: "Your SMILES (not found in PubChem)", formula: null, smiles: trimmed, url: null },
      note: "PubChem has no record of this exact molecule. The syntax looks valid, so SwissDock can still try; double-check it.",
    };
  } catch {
    return {
      ok: true,
      candidate: { source: "smiles", id: null, name: "Your SMILES", formula: null, smiles: trimmed, url: null },
      note: "PubChem could not be reached to identify this molecule. The syntax looks valid.",
    };
  }
}

// ---------- name / chemical component ID search ----------

async function lookupChemComp(id: string): Promise<LigandCandidate | null> {
  const code = id.toUpperCase();
  const { status, body } = await fetchJson(`https://data.rcsb.org/rest/v1/core/chemcomp/${encodeURIComponent(code)}`);
  if (status !== 200 || !body || typeof body !== "object") return null;
  const record = body as {
    chem_comp?: { name?: string; formula?: string };
    rcsb_chem_comp_descriptor?: { SMILES?: string; SMILES_stereo?: string };
  };
  const smiles = record.rcsb_chem_comp_descriptor?.SMILES_stereo ?? record.rcsb_chem_comp_descriptor?.SMILES ?? null;
  if (!smiles) return null;
  return {
    source: "rcsb-chemcomp",
    id: code,
    name: record.chem_comp?.name ?? code,
    formula: record.chem_comp?.formula ?? null,
    smiles,
    url: `https://www.rcsb.org/ligand/${code}`,
  };
}

export async function searchLigands(query: string): Promise<{ results: LigandCandidate[]; errors: string[] }> {
  const q = query.trim();
  if (q.length < 2 || q.length > 80) {
    throw new ServiceError("Search needs 2–80 characters (a name like \"acetate\" or an ID like ATP).", 400);
  }
  const errors: string[] = [];
  const tasks: Promise<LigandCandidate[]>[] = [];
  if (/^[A-Za-z0-9]{1,5}$/.test(q)) {
    tasks.push(
      lookupChemComp(q)
        .then((c) => (c ? [c] : []))
        .catch(() => {
          errors.push("RCSB chemical component lookup failed.");
          return [];
        }),
    );
  }
  tasks.push(
    fetchJson(`${PUBCHEM}/compound/name/${encodeURIComponent(q)}/property/${PUBCHEM_PROPS}/JSON`)
      .then(({ body }) =>
        pubchemRows(body)
          .slice(0, 3)
          .map(pubchemCandidate)
          .filter((c): c is LigandCandidate => c !== null),
      )
      .catch(() => {
        errors.push("PubChem search failed.");
        return [];
      }),
  );
  const results = (await Promise.all(tasks)).flat();
  return { results, errors };
}

// ---------- suggestions grounded in real data (CLEAN EC → Rhea) ----------

const TRIVIAL = new Set(["H2O", "H(+)", "O2", "CO2", "phosphate", "diphosphate", "NH4(+)"]);

export function parseRheaParticipants(equation: string): string[] {
  return equation
    .split(/\s+=\s+|\s+<=>\s+|\s+\+\s+/)
    .map((p) => p.trim().replace(/^\d+\s+/, ""))
    .filter((p) => p && !TRIVIAL.has(p) && !/^(a|an)\s/i.test(p));
}

export async function suggestLigands(db: AppDatabase, projectId: string): Promise<{
  basis: string | null;
  names: string[];
}> {
  const clean = await listCleanResults(db, projectId).catch(() => null);
  const top = (clean?.latestNormalized as CleanNormalizedResult | null | undefined)?.topPrediction;
  const ec = top?.ecNumber;
  if (!ec || !/^\d+\.\d+\.\d+\.\d+$/.test(ec)) return { basis: null, names: [] };
  try {
    const res = await fetch(
      `https://www.rhea-db.org/rhea?query=${encodeURIComponent(`ec:${ec}`)}&columns=rhea-id,equation&format=tsv&limit=5`,
      { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
    );
    if (!res.ok) return { basis: null, names: [] };
    const rows = (await res.text()).split("\n").slice(1).filter(Boolean);
    const names = new Set<string>();
    const ids: string[] = [];
    for (const row of rows) {
      const [id, equation] = row.split("\t");
      if (!equation) continue;
      ids.push(id!);
      for (const name of parseRheaParticipants(equation)) names.add(name);
    }
    if (names.size === 0) return { basis: null, names: [] };
    return {
      basis: `Substrates/products of EC ${ec} (CLEAN's top prediction) from Rhea ${ids.slice(0, 3).join(", ")}`,
      names: [...names].slice(0, 8),
    };
  } catch {
    return { basis: null, names: [] };
  }
}

// ---------- chooser setup: structure ligands + box candidates ----------

function residueLabel(r: { chain?: string | null; position: number | string; aminoAcid?: string | null }) {
  return `${r.aminoAcid ? `${r.aminoAcid} ` : ""}${r.chain ? `${r.chain}:` : ""}${r.position}`;
}

export async function getLigandChooserSetup(db: AppDatabase, projectId: string) {
  const pdbId = await projectPdbId(db, projectId);
  const pdbText = await fetchPdbText(pdbId);
  const hets: StructureHetEntry[] = listHetGroups(pdbText).map((g) => ({
    ...g,
    categoryLabel: HET_CATEGORY_LABELS[g.category],
    dockable: g.category === "ligand" || g.category === "additive",
  }));

  const boxes: BoxCandidate[] = [];
  const [evidence, sprite, suggestions] = await Promise.all([
    listEvidenceForProject(db, projectId).catch(() => []),
    listSpriteResults(db, projectId).catch(() => null),
    suggestLigands(db, projectId),
  ]);

  const spriteData = sprite?.latestNormalized as SpriteNormalizedSearch | null | undefined;
  const best = spriteData?.hits
    .filter((h) => h.matchResidues.length > 0)
    .sort((a, b) => (a.rmsd ?? Infinity) - (b.rmsd ?? Infinity))[0];
  if (best) {
    const refs: ResidueRef[] = best.matchResidues
      .filter((r) => r.resNo)
      .map((r) => ({ chain: r.chain, position: String(r.resNo).replace(/[^\d-]/g, "") }));
    const center = residueCentroid(pdbText, refs);
    if (center) {
      boxes.push({
        id: "sprite-best",
        kind: "sprite",
        center: center.boxCenter,
        label: `SPRITE closest active-site match (${best.pdbId}${best.patternId ? ` pattern ${best.patternId}` : ""}, RMSD ${best.rmsd ?? "—"} Å): ${best.matchResidues
          .map((r) => `${r.resType ?? ""} ${r.chain ?? ""}:${r.resNo ?? ""}`.trim())
          .join(", ")}`,
      });
    }
  }

  for (const item of evidence) {
    const residues = item.residues ?? [];
    if (residues.length === 0) continue;
    const center = residueCentroid(pdbText, residues);
    if (!center) continue;
    boxes.push({
      id: `evidence-${item.id}`,
      kind: "evidence",
      center: center.boxCenter,
      label: `Evidence: ${residues.map(residueLabel).join(", ")} — ${item.description.slice(0, 80)}`,
    });
  }

  return { pdbId, hets, boxes, suggestions };
}

export async function centerOnResidues(db: AppDatabase, projectId: string, residues: ResidueRef[]) {
  if (residues.length === 0 || residues.length > 30) {
    throw new ServiceError("List 1–30 residues like A:114, A:207.", 400);
  }
  const pdbId = await projectPdbId(db, projectId);
  const result = residueCentroid(await fetchPdbText(pdbId), residues);
  if (!result) {
    throw new ServiceError(`None of those residues exist in ${pdbId}. Check the chain letter and number.`, 400);
  }
  return result;
}
