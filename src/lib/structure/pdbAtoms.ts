/**
 * Minimal PDB / PDBQT coordinate parsing for real distance measurements.
 * Only reads what the files contain — never fills in missing atoms.
 */

export interface Atom {
  chain: string;
  resNo: string; // author number incl. insertion code
  resName: string;
  name: string;
  element: string;
  x: number;
  y: number;
  z: number;
}

const THREE_TO_ONE: Record<string, string> = {
  ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLN: "Q", GLU: "E", GLY: "G",
  HIS: "H", ILE: "I", LEU: "L", LYS: "K", MET: "M", PHE: "F", PRO: "P", SER: "S",
  THR: "T", TRP: "W", TYR: "Y", VAL: "V", MSE: "M", SEC: "U", PYL: "O",
};

export function oneLetter(resName: string): string {
  return THREE_TO_ONE[resName.toUpperCase()] ?? "X";
}

function elementOf(line: string, name: string): string {
  const col = line.slice(76, 78).trim();
  if (col && /^[A-Za-z]{1,2}$/.test(col)) return col.toUpperCase();
  return name.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
}

/** Atoms of the first MODEL. `protein` keeps ATOM records plus HETATM MSE (selenomethionine). */
export function parsePdbAtoms(text: string, options: { protein?: boolean } = {}): Atom[] {
  const atoms: Atom[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("ENDMDL")) break;
    const isAtom = line.startsWith("ATOM  ");
    const isHet = line.startsWith("HETATM");
    if (!isAtom && !isHet) continue;
    const resName = line.slice(17, 20).trim();
    if (options.protein && !(isAtom || resName === "MSE")) continue;
    if (options.protein && !(resName in THREE_TO_ONE)) continue;
    const altLoc = line.charAt(16);
    if (altLoc !== " " && altLoc !== "A" && altLoc !== "") continue;
    const name = line.slice(12, 16).trim();
    const x = Number(line.slice(30, 38));
    const y = Number(line.slice(38, 46));
    const z = Number(line.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) continue;
    atoms.push({
      chain: line.charAt(21).trim(),
      resNo: `${line.slice(22, 26).trim()}${line.charAt(26).trim()}`,
      resName,
      name,
      element: elementOf(line, name),
      x,
      y,
      z,
    });
  }
  return atoms;
}

/** Ordered residues (by CA) of one chain: author numbers + one-letter sequence. */
export function chainResidues(atoms: Atom[], chain: string): { resNo: string; resName: string }[] {
  const out: { resNo: string; resName: string }[] = [];
  const seen = new Set<string>();
  for (const atom of atoms) {
    if (atom.chain !== chain || atom.name !== "CA") continue;
    if (seen.has(atom.resNo)) continue;
    seen.add(atom.resNo);
    out.push({ resNo: atom.resNo, resName: atom.resName });
  }
  return out;
}

export interface ResidueDistance {
  chain: string;
  resNo: string;
  resName: string;
  /** Closest heavy-atom distance to the ligand pose, Å (2 decimals). */
  minDistance: number;
  closestAtom: string;
}

/** Per-residue closest heavy-atom distance from protein to ligand, keeping residues within `maxDistance`. */
export function residueDistances(protein: Atom[], ligand: Atom[], maxDistance = 8): ResidueDistance[] {
  const heavyLigand = ligand.filter((a) => a.element !== "H");
  const best = new Map<string, ResidueDistance>();
  const max2 = maxDistance * maxDistance;
  for (const p of protein) {
    if (p.element === "H") continue;
    for (const l of heavyLigand) {
      const dx = p.x - l.x;
      const dy = p.y - l.y;
      const dz = p.z - l.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > max2) continue;
      const key = `${p.chain}:${p.resNo}`;
      const d = Math.round(Math.sqrt(d2) * 100) / 100;
      const prev = best.get(key);
      if (!prev || d < prev.minDistance) {
        best.set(key, { chain: p.chain, resNo: p.resNo, resName: p.resName, minDistance: d, closestAtom: p.name });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.minDistance - b.minDistance);
}

/** Atom lines of the first pose (MODEL 1) in a Vina PDBQT. */
export function firstPdbqtModel(text: string): string | null {
  const lines: string[] = [];
  let inModel = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("MODEL")) {
      if (inModel) break;
      inModel = true;
      continue;
    }
    if (line.startsWith("ENDMDL")) break;
    if (line.startsWith("ATOM  ") || line.startsWith("HETATM")) lines.push(line);
  }
  return lines.length ? lines.join("\n") : null;
}

/** PDBQT atom lines → atoms (element from the AutoDock type column). */
export function parsePdbqtAtoms(text: string): Atom[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.startsWith("ATOM  ") || l.startsWith("HETATM"))
    .map((line) => {
      const name = line.slice(12, 16).trim();
      const adType = line.slice(77, 79).trim().toUpperCase();
      const element = adType === "HD" || adType === "H" ? "H" : adType === "A" ? "C" : adType.replace(/A$/, "").charAt(0) || name.charAt(0);
      return {
        chain: "L",
        resNo: line.slice(22, 26).trim(),
        resName: line.slice(17, 20).trim(),
        name,
        element: element.toUpperCase(),
        x: Number(line.slice(30, 38)),
        y: Number(line.slice(38, 46)),
        z: Number(line.slice(46, 54)),
      };
    })
    .filter((a) => [a.x, a.y, a.z].every(Number.isFinite));
}

export async function fetchRcsbPdbText(pdbId: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20_000): Promise<string | null> {
  try {
    const res = await fetchImpl(`https://files.rcsb.org/download/${encodeURIComponent(pdbId.toUpperCase())}.pdb`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
