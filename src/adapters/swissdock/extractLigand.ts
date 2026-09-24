/** Common solvent / crystallization additives — never treat as docking ligands. */
export const SKIP_RESIDUES = new Set([
  "HOH",
  "WAT",
  "DOD",
  "H2O",
  "SOL",
  "TIP",
  "TP3",
  "TIP3",
  "DMS",
  "DMSO",
  "EOH",
  "GOL",
  "EDO",
  "PEG",
  "SO4",
  "PO4",
  "NO3",
  "CL",
  "NA",
  "K",
  "MG",
  "CA",
  "ZN",
  "ACT",
  "ACE",
  "FMT",
  "MPD",
  "TRS",
  "BME",
  "EPE",
  "MES",
  "NH4",
  "IOD",
  "BR",
  "MN",
  "FE",
  "FE2",
  "CU",
  "CO",
  "NI",
  "CD",
  "HG",
  "UNX",
]);

/**
 * Modified amino acids that are part of the protein chain (not ligands),
 * e.g. selenomethionine (MSE) in SAD-phased structures. MODRES records in the
 * PDB file are also honored.
 */
export const POLYMER_MODIFIED_RESIDUES = new Set([
  "MSE",
  "SEP",
  "TPO",
  "PTR",
  "CSO",
  "CSD",
  "CME",
  "OCS",
  "KCX",
  "LLP",
  "HYP",
  "MLY",
  "M3L",
  "PCA",
  "CGU",
  "SEC",
  "PYL",
  "NLE",
  "ALY",
  "CSX",
]);

export interface ExtractedLigand {
  resName: string;
  chain: string;
  atomCount: number;
  boxCenter: string;
  /** Mean coordinates used for box center. */
  center: { x: number; y: number; z: number };
}

/**
 * Pick the largest non-solvent, non-polymer HETATM residue instance and compute its centroid.
 * Never invents a ligand — returns null when none are present.
 */
export function extractLigandFromPdbText(
  pdbText: string,
): ExtractedLigand | null {
  const groups = new Map<
    string,
    { resName: string; chain: string; xs: number[]; ys: number[]; zs: number[] }
  >();
  const lines = pdbText.split(/\r?\n/);
  const modres = new Set(
    lines
      .filter((line) => line.startsWith("MODRES"))
      .map((line) => line.slice(12, 15).trim().toUpperCase())
      .filter(Boolean),
  );

  for (const line of lines) {
    if (!line.startsWith("HETATM")) continue;
    let resName = line.length >= 20 ? line.slice(17, 20).trim().toUpperCase() : "";
    let chain = line.length >= 22 ? (line[21] ?? "A").trim() || "A" : "A";
    let x = Number(line.length >= 54 ? line.slice(30, 38) : NaN);
    let y = Number(line.length >= 54 ? line.slice(38, 46) : NaN);
    let z = Number(line.length >= 54 ? line.slice(46, 54) : NaN);
    if (!resName || ![x, y, z].every((n) => Number.isFinite(n))) {
      // Fallback for loosely spaced test/export lines
      const parts = line.trim().split(/\s+/);
      // HETATM serial name resName chain seq x y z ...
      if (parts.length >= 9) {
        resName = (parts[3] ?? "").toUpperCase();
        chain = parts[4] ?? "A";
        // chain may be glued to seq (A142) in some exports
        if (chain.length > 1 && /^[A-Za-z]/.test(chain)) {
          chain = chain[0]!;
        }
        x = Number(parts[5]);
        y = Number(parts[6]);
        z = Number(parts[7]);
        // Some lines: HETATM serial name resName chain seq x y z
        if (![x, y, z].every((n) => Number.isFinite(n)) && parts.length >= 10) {
          x = Number(parts[6]);
          y = Number(parts[7]);
          z = Number(parts[8]);
        }
      }
    }
    if (!resName || SKIP_RESIDUES.has(resName)) continue;
    if (POLYMER_MODIFIED_RESIDUES.has(resName) || modres.has(resName)) continue;
    if (![x, y, z].every((n) => Number.isFinite(n))) continue;
    // One group per residue instance so the box centers on a single copy.
    const resSeq = line.length >= 27 ? line.slice(22, 27).trim() : "";
    const key = `${resName}|${chain}|${resSeq}`;
    const existing = groups.get(key);
    if (existing) {
      existing.xs.push(x);
      existing.ys.push(y);
      existing.zs.push(z);
    } else {
      groups.set(key, { resName, chain, xs: [x], ys: [y], zs: [z] });
    }
  }

  if (groups.size === 0) return null;

  let best: ExtractedLigand | null = null;
  for (const g of groups.values()) {
    const atomCount = g.xs.length;
    const x = g.xs.reduce((a, b) => a + b, 0) / atomCount;
    const y = g.ys.reduce((a, b) => a + b, 0) / atomCount;
    const z = g.zs.reduce((a, b) => a + b, 0) / atomCount;
    const candidate: ExtractedLigand = {
      resName: g.resName,
      chain: g.chain,
      atomCount,
      center: { x, y, z },
      boxCenter: `${x.toFixed(3)}_${y.toFixed(3)}_${z.toFixed(3)}`,
    };
    if (!best || candidate.atomCount > best.atomCount) {
      best = candidate;
    }
  }
  return best;
}

export function parseChemCompSmiles(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const descriptor = record.rcsb_chem_comp_descriptor;
  if (
    descriptor &&
    typeof descriptor === "object" &&
    !Array.isArray(descriptor)
  ) {
    const d = descriptor as Record<string, unknown>;
    if (typeof d.SMILES === "string" && d.SMILES.trim()) {
      return d.SMILES.trim();
    }
    if (typeof d.SMILES_stereo === "string" && d.SMILES_stereo.trim()) {
      return d.SMILES_stereo.trim();
    }
  }
  return null;
}

const WATER = new Set(["HOH", "WAT", "DOD", "H2O", "SOL", "TIP", "TP3", "TIP3"]);
const IONS = new Set([
  "CL", "NA", "K", "MG", "CA", "ZN", "MN", "FE", "FE2", "CU", "CO", "NI", "CD",
  "HG", "IOD", "BR", "NH4", "UNX", "SO4", "PO4", "NO3",
]);

export type HetCategory = "ligand" | "modified-residue" | "additive" | "ion";

export interface HetGroup {
  resName: string;
  chain: string;
  resSeq: string;
  atomCount: number;
  category: HetCategory;
  boxCenter: string;
}

export const HET_CATEGORY_LABELS: Record<HetCategory, string> = {
  ligand: "Ligand bound in the crystal",
  "modified-residue": "Modified amino acid — part of the protein chain, not a ligand",
  additive: "Buffer / crystallization additive (usually not biologically meaningful)",
  ion: "Ion or salt",
};

function centerText(xs: number[], ys: number[], zs: number[]): string {
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return `${avg(xs).toFixed(3)}_${avg(ys).toFixed(3)}_${avg(zs).toFixed(3)}`;
}

/** Every non-water HETATM residue instance, labelled honestly (waters omitted). */
export function listHetGroups(pdbText: string): HetGroup[] {
  const lines = pdbText.split(/\r?\n/);
  const modres = new Set(
    lines
      .filter((line) => line.startsWith("MODRES"))
      .map((line) => line.slice(12, 15).trim().toUpperCase())
      .filter(Boolean),
  );
  const groups = new Map<string, { g: Omit<HetGroup, "atomCount" | "boxCenter">; xs: number[]; ys: number[]; zs: number[] }>();
  for (const line of lines) {
    if (!line.startsWith("HETATM") || line.length < 54) continue;
    const resName = line.slice(17, 20).trim().toUpperCase();
    if (!resName || WATER.has(resName)) continue;
    const chain = line[21]?.trim() || "A";
    const resSeq = line.slice(22, 27).trim();
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) continue;
    const category: HetCategory =
      POLYMER_MODIFIED_RESIDUES.has(resName) || modres.has(resName)
        ? "modified-residue"
        : IONS.has(resName)
          ? "ion"
          : SKIP_RESIDUES.has(resName)
            ? "additive"
            : "ligand";
    const key = `${resName}|${chain}|${resSeq}`;
    const entry = groups.get(key) ?? { g: { resName, chain, resSeq, category }, xs: [], ys: [], zs: [] };
    entry.xs.push(x);
    entry.ys.push(y);
    entry.zs.push(z);
    groups.set(key, entry);
  }
  const order: HetCategory[] = ["ligand", "additive", "ion", "modified-residue"];
  return [...groups.values()]
    .map(({ g, xs, ys, zs }) => ({ ...g, atomCount: xs.length, boxCenter: centerText(xs, ys, zs) }))
    .sort(
      (a, b) =>
        order.indexOf(a.category) - order.indexOf(b.category) || b.atomCount - a.atomCount,
    );
}

export interface ResidueRef {
  chain?: string | null;
  position: number | string;
}

/** Parse "A:114, A:207, 245" into residue refs (chain optional). */
export function parseResidueList(text: string): ResidueRef[] {
  return text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const m = token.match(/^(?:([A-Za-z0-9]):?)?(?:[A-Za-z]{3})?(-?\d+)$/);
      const ref: ResidueRef | null = m ? { chain: m[1] ?? null, position: Number(m[2]) } : null;
      return ref;
    })
    .filter((r): r is ResidueRef => r !== null);
}

/**
 * Centroid of the listed residues' atoms (ATOM + HETATM) in the PDB text.
 * Returns null when none of the residues exist — never guesses coordinates.
 */
export function residueCentroid(
  pdbText: string,
  residues: ResidueRef[],
): { boxCenter: string; found: string[]; missing: string[] } | null {
  const wanted = residues.map((r) => ({
    chain: r.chain ? String(r.chain).toUpperCase() : null,
    position: String(r.position).trim(),
  }));
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const found = new Set<string>();
  let firstModelDone = false;
  for (const line of pdbText.split(/\r?\n/)) {
    if (line.startsWith("ENDMDL")) firstModelDone = true;
    if (firstModelDone) break;
    if (!(line.startsWith("ATOM") || line.startsWith("HETATM")) || line.length < 54) continue;
    const chain = (line[21] ?? "").trim().toUpperCase();
    const resSeq = line.slice(22, 26).trim();
    const match = wanted.find((w) => w.position === resSeq && (!w.chain || w.chain === chain));
    if (!match) continue;
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) continue;
    xs.push(x);
    ys.push(y);
    zs.push(z);
    found.add(`${chain}:${resSeq}:${line.slice(17, 20).trim()}`);
  }
  if (xs.length === 0) return null;
  const foundKeys = [...found];
  const missing = wanted
    .filter((w) => !foundKeys.some((k) => {
      const [c, p] = k.split(":");
      return p === w.position && (!w.chain || w.chain === c);
    }))
    .map((w) => `${w.chain ? `${w.chain}:` : ""}${w.position}`);
  return { boxCenter: centerText(xs, ys, zs), found: foundKeys, missing };
}
