const CLASSIC_PDB_ID = /^[0-9][A-Za-z0-9]{3}$/;

export type PdbIdValidationResult =
  | { ok: true; pdbId: string }
  | { ok: false; error: string };

export function validatePdbId(input: string): PdbIdValidationResult {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "Enter a PDB identifier." };
  }

  const pdbId = input.trim().toUpperCase();

  if (/\s/.test(input.trim())) {
    return { ok: false, error: "A PDB identifier cannot contain spaces." };
  }

  if (!CLASSIC_PDB_ID.test(pdbId)) {
    return {
      ok: false,
      error:
        "Use a classic four-character PDB ID (a digit followed by three letters or digits), for example 4HHB. The identifier is stored as entered after uppercase normalization. Use Retrieve metadata from RCSB to load verified title, organism, chains, and sequence.",
    };
  }

  return { ok: true, pdbId };
}
