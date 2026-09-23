/** UniProtKB accession patterns (classic 6-char and extended). */
const UNIPROT_ACCESSION =
  /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/;

export type UniProtValidationResult =
  | { ok: true; accession: string }
  | { ok: false; error: string };

export function validateUniProtAccession(input: string): UniProtValidationResult {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "Enter a UniProt accession (for example P04637)." };
  }

  if (/\s/.test(input.trim())) {
    return {
      ok: false,
      error: "A UniProt accession cannot contain spaces.",
    };
  }

  const accession = input.trim().toUpperCase();

  if (!UNIPROT_ACCESSION.test(accession)) {
    return {
      ok: false,
      error:
        "Use a UniProtKB accession such as P04637 or A0A024R1R8. Entry names like P53_HUMAN are not accepted here — look up the accession on uniprot.org.",
    };
  }

  return { ok: true, accession };
}
