import {
  CleanAdapterError,
  type CleanConfidenceLevel,
  type CleanPrediction,
  type CleanSequencePredictions,
} from "@/adapters/clean/types";

/** Top-level EC classes (IUBMB). Deterministic — no network needed. */
export const EC_TOP_LEVEL_CLASSES: Record<string, string> = {
  "1": "Oxidoreductases",
  "2": "Transferases",
  "3": "Hydrolases",
  "4": "Lyases",
  "5": "Isomerases",
  "6": "Ligases",
  "7": "Translocases",
};

/** Official CLEAN web app thresholds: ≥0.8 High, 0.2–0.8 Medium, <0.2 Low. */
export function cleanConfidenceLevel(score: number): CleanConfidenceLevel {
  if (score >= 0.8) return "High";
  if (score >= 0.2) return "Medium";
  return "Low";
}

/** "EC:4.2.1.1" → "4.2.1.1". Returns null for anything that is not an EC id. */
export function normalizeEcNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^EC[:\s]*/i, "");
  // Allow partial / preliminary EC numbers like 3.4.21.-, 1.1.1.n1
  if (!/^[1-7](\.(\d+|-|n\d+)){0,3}$/i.test(trimmed)) return null;
  return trimmed;
}

export function enzymeClassForEc(ecNumber: string): string | null {
  return EC_TOP_LEVEL_CLASSES[ecNumber.split(".")[0] ?? ""] ?? null;
}

export function expasyUrlForEc(ecNumber: string): string | null {
  // Only full 4-level numeric ECs have ExPASy entry pages.
  return /^\d+\.\d+\.\d+\.\d+$/.test(ecNumber)
    ? `https://enzyme.expasy.org/EC/${ecNumber}`
    : null;
}

function toScore(raw: unknown): number | null {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

export function buildPrediction(
  ecRaw: unknown,
  scoreRaw: unknown,
): CleanPrediction | null {
  const ecNumber = normalizeEcNumber(ecRaw);
  const score = toScore(scoreRaw);
  if (!ecNumber || score === null) return null;
  return {
    ecNumber,
    score,
    level: cleanConfidenceLevel(score),
    enzymeClass: enzymeClassForEc(ecNumber),
    enzymeName: null,
    expasyUrl: expasyUrlForEc(ecNumber),
  };
}

function sortPredictions(predictions: CleanPrediction[]): CleanPrediction[] {
  return [...predictions].sort((a, b) => b.score - a.score);
}

/**
 * Parse the body of GET /clean/results/{job_id}.
 *
 * Confirmed shape (mmli-backend CleanService.cleanResultPostProcess and the
 * official CLEAN SPA, which JSON.parse()s the body):
 *   [{ "sequence": "<fasta header>", "result": [{ "ecNumber": "EC:4.2.1.1", "score": 0.97 }] }]
 * The body may arrive already parsed or as a JSON-encoded string.
 * Never invents predictions: malformed input throws INVALID_RESPONSE.
 */
export function parseCleanResultsBody(body: unknown): CleanSequencePredictions[] {
  let value = body;
  for (let i = 0; i < 2 && typeof value === "string"; i += 1) {
    try {
      value = JSON.parse(value);
    } catch (error) {
      throw new CleanAdapterError(
        "INVALID_RESPONSE",
        "CLEAN returned results that are not valid JSON. No EC numbers were invented.",
        null,
        error,
      );
    }
  }
  if (!Array.isArray(value)) {
    throw new CleanAdapterError(
      "INVALID_RESPONSE",
      "CLEAN returned an unexpected results payload (expected a list of sequences). No EC numbers were invented.",
    );
  }

  return value.map((entry, index) => {
    const record =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : null;
    if (!record) {
      throw new CleanAdapterError(
        "INVALID_RESPONSE",
        `CLEAN result #${index + 1} is not an object. No EC numbers were invented.`,
      );
    }
    const header =
      typeof record.sequence === "string" && record.sequence.trim()
        ? record.sequence.trim()
        : `sequence_${index + 1}`;
    const rawResults = Array.isArray(record.result) ? record.result : [];
    const predictions = rawResults
      .map((item) => {
        const r =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {};
        return buildPrediction(r.ecNumber ?? r.ec_number ?? r.ec, r.score);
      })
      .filter((p): p is CleanPrediction => p !== null);
    return { header, predictions: sortPredictions(predictions) };
  });
}

/**
 * Parse a CLEAN "maxsep" CSV export (what CLEAN_infer_fasta.py writes and
 * what the web app downloads), e.g.
 *   WP_041412631,EC:4.2.1.25/0.9903,EC:4.2.1.67/0.9781
 * Used for the CSV import fallback. Lines that do not parse are ignored;
 * returns [] when nothing parses (caller decides how to report that).
 */
export function parseCleanMaxsepCsv(text: string): CleanSequencePredictions[] {
  const rows: CleanSequencePredictions[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line.split(/[,\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const header = cells[0];
    if (!header) continue;
    const predictions = cells
      .slice(1)
      .map((cell) => {
        const slash = cell.lastIndexOf("/");
        if (slash <= 0) return null;
        return buildPrediction(cell.slice(0, slash), cell.slice(slash + 1));
      })
      .filter((p): p is CleanPrediction => p !== null);
    if (predictions.length > 0) {
      rows.push({ header, predictions: sortPredictions(predictions) });
    }
  }
  return rows;
}

/** Parse the DE (accepted name) line of an ExPASy ENZYME flat-file entry. */
export function parseExpasyEnzymeName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("DE   "))
    .map((line) => line.slice(5).trim());
  if (lines.length === 0) return null;
  const name = lines.join(" ").replace(/\.$/, "").trim();
  if (!name || /^(Transferred entry|Deleted entry)/i.test(name)) return null;
  return name;
}
