import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeSwissDockPayload } from "@/adapters/swissdock/normalize";
import {
  SWISSDOCK_API_BASE,
  SWISSDOCK_PROVENANCE_SOURCE,
  SwissDockAdapterError,
  type SwissDockFetchInput,
  type SwissDockNormalizedSearch,
  type SwissDockRawPayload,
} from "@/adapters/swissdock/types";
import { validatePdbId } from "@/lib/validation/pdbId";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

export interface SwissDockAdapterOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const rcsbPdbUrl = (pdbId: string) =>
  `https://files.rcsb.org/download/${pdbId}.pdb`;

function parseSessionNumber(text: string): string | null {
  const match =
    text.match(/Session number:\s*(\d+)/i) ??
    text.match(/sessionNumber=(\d+)/i);
  return match?.[1] ?? null;
}

function isFinishedStatus(text: string): boolean {
  return /finished|completed|done|ready to retrieve|retrievesession/i.test(
    text,
  );
}

function isFailedStatus(text: string): boolean {
  return /\bERROR\b|\bfailed\b|\bimpossible\b/i.test(text);
}

function isStillRunning(text: string): boolean {
  return /running|queued|preparing|please wait|in progress|submitted/i.test(
    text,
  );
}

export class SwissDockSearchAdapter
  implements
    ScientificAdapter<
      SwissDockFetchInput,
      SwissDockRawPayload,
      SwissDockNormalizedSearch
    >
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;

  constructor(options: SwissDockAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    // SwissDock steps can be slow
    this.timeoutMs = options.timeoutMs ?? Math.max(DEFAULT_ADAPTER_TIMEOUT_MS, 45_000);
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit | undefined,
    label: string,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new SwissDockAdapterError(
          "TIMEOUT",
          `Timed out contacting SwissDock (${label}). No poses were invented.`,
          error,
        );
      }
      throw new SwissDockAdapterError(
        "NETWORK",
        `Could not reach SwissDock (${label}). Outbound :8443 may be blocked. No poses were invented.`,
        error,
      );
    }
  }

  private setProvenance(params: Record<string, unknown>, retrievedAt: string) {
    this.lastProvenance = buildProvenance({
      tool: "SwissDock",
      source: SWISSDOCK_PROVENANCE_SOURCE,
      retrievedAt,
      parameters: params,
      version: "SwissDock CLI REST (Vina)",
    });
  }

  private validateInputs(input: SwissDockFetchInput) {
    const validation = validatePdbId(input.pdbId);
    if (!validation.ok) {
      throw new SwissDockAdapterError("VALIDATION", validation.error);
    }
    const smiles = input.smiles.trim();
    if (smiles.length < 2) {
      throw new SwissDockAdapterError(
        "VALIDATION",
        "Ligand SMILES is required. The platform will not invent a ligand.",
      );
    }
    if (!/^[A-Za-z0-9@+\-\[\]\(\)=#$:/\\.]+$/.test(smiles)) {
      throw new SwissDockAdapterError(
        "VALIDATION",
        "SMILES contains unexpected characters.",
      );
    }
    const boxCenter = input.boxCenter.trim();
    const boxSize = input.boxSize.trim();
    if (!/^-?\d+(\.\d+)?_-?\d+(\.\d+)?_-?\d+(\.\d+)?$/.test(boxCenter)) {
      throw new SwissDockAdapterError(
        "VALIDATION",
        "boxCenter must look like x_y_z (e.g. 10.0_5.0_-3.2). Do not invent coordinates.",
      );
    }
    if (!/^\d+(\.\d+)?_\d+(\.\d+)?_\d+(\.\d+)?$/.test(boxSize)) {
      throw new SwissDockAdapterError(
        "VALIDATION",
        "boxSize must look like a_b_c (e.g. 20_20_20).",
      );
    }
    return {
      pdbId: validation.pdbId,
      smiles,
      boxCenter,
      boxSize,
      exhaust: input.exhaustiveness ?? 8,
    };
  }

  async run(input: SwissDockFetchInput): Promise<SwissDockRawPayload> {
    const { pdbId, smiles, boxCenter, boxSize, exhaust } =
      this.validateInputs(input);
    const retrievedAt = nowIso();

    // 1) preplig with Vina + SMILES
    const prepligUrl = `${SWISSDOCK_API_BASE}/preplig?Vina&mySMILES=${encodeURIComponent(smiles)}`;
    const prepligRes = await this.fetchWithTimeout(
      prepligUrl,
      undefined,
      "preplig",
    );
    const prepligText = await prepligRes.text();
    if (!prepligRes.ok) {
      throw new SwissDockAdapterError(
        "NETWORK",
        `SwissDock preplig returned HTTP ${prepligRes.status}.`,
      );
    }
    const sessionNumber = parseSessionNumber(prepligText);
    if (!sessionNumber) {
      throw new SwissDockAdapterError(
        "INVALID_RESPONSE",
        "SwissDock preplig did not return a sessionNumber. No poses were invented.",
      );
    }

    // 2) Download PDB from RCSB and preptarget
    const pdbRes = await this.fetchWithTimeout(
      rcsbPdbUrl(pdbId),
      undefined,
      "RCSB PDB",
    );
    if (!pdbRes.ok) {
      throw new SwissDockAdapterError(
        "NETWORK",
        `Could not download PDB ${pdbId} from RCSB for SwissDock.`,
      );
    }
    const pdbText = await pdbRes.text();
    const form = new FormData();
    form.append(
      "myTarget",
      new Blob([pdbText], { type: "chemical/x-pdb" }),
      `${pdbId}.pdb`,
    );
    const preptargetUrl = `${SWISSDOCK_API_BASE}/preptarget?sessionNumber=${encodeURIComponent(sessionNumber)}`;
    const prepTargetRes = await this.fetchWithTimeout(
      preptargetUrl,
      { method: "POST", body: form },
      "preptarget",
    );
    const prepTargetText = await prepTargetRes.text();
    if (!prepTargetRes.ok) {
      throw new SwissDockAdapterError(
        "NETWORK",
        `SwissDock preptarget returned HTTP ${prepTargetRes.status}.`,
      );
    }

    // 3) setparameters
    const paramsUrl =
      `${SWISSDOCK_API_BASE}/setparameters?sessionNumber=${encodeURIComponent(sessionNumber)}` +
      `&exhaust=${exhaust}&boxCenter=${encodeURIComponent(boxCenter)}` +
      `&boxSize=${encodeURIComponent(boxSize)}`;
    const paramsRes = await this.fetchWithTimeout(
      paramsUrl,
      undefined,
      "setparameters",
    );
    const paramsText = await paramsRes.text();
    if (!paramsRes.ok) {
      throw new SwissDockAdapterError(
        "NETWORK",
        `SwissDock setparameters returned HTTP ${paramsRes.status}.`,
      );
    }

    // 4) startdock
    const startUrl = `${SWISSDOCK_API_BASE}/startdock?sessionNumber=${encodeURIComponent(sessionNumber)}`;
    const startRes = await this.fetchWithTimeout(
      startUrl,
      undefined,
      "startdock",
    );
    const startText = await startRes.text();
    if (!startRes.ok) {
      throw new SwissDockAdapterError(
        "NETWORK",
        `SwissDock startdock returned HTTP ${startRes.status}.`,
      );
    }

    this.setProvenance(
      {
        sessionNumber,
        pdbId,
        smiles,
        boxCenter,
        boxSize,
        exhaust,
        phase: "docking",
        prepligSnippet: prepligText.slice(0, 200),
        preptargetSnippet: prepTargetText.slice(0, 200),
        paramsSnippet: paramsText.slice(0, 200),
        startSnippet: startText.slice(0, 200),
        api: SWISSDOCK_API_BASE,
      },
      retrievedAt,
    );

    return this.pollSession(sessionNumber, pdbId, smiles, {
      allowPending: true,
      retrievedAt,
    });
  }

  async pollSession(
    sessionNumber: string,
    pdbId: string,
    smiles: string,
    options?: { allowPending?: boolean; retrievedAt?: string },
  ): Promise<SwissDockRawPayload> {
    const retrievedAt = options?.retrievedAt ?? nowIso();
    const allowPending = options?.allowPending ?? false;
    if (!/^\d+$/.test(sessionNumber)) {
      throw new SwissDockAdapterError("VALIDATION", "Invalid sessionNumber.");
    }

    const statusUrl = `${SWISSDOCK_API_BASE}/checkstatus?sessionNumber=${encodeURIComponent(sessionNumber)}`;
    const statusRes = await this.fetchWithTimeout(
      statusUrl,
      undefined,
      "checkstatus",
    );
    const statusText = await statusRes.text();
    if (!statusRes.ok) {
      throw new SwissDockAdapterError(
        "NETWORK",
        `SwissDock checkstatus returned HTTP ${statusRes.status}.`,
      );
    }

    if (isFailedStatus(statusText) && !isFinishedStatus(statusText)) {
      // Distinguish hard failures from "must contain ligand" early messages
      if (/Impossible|ERROR:/i.test(statusText)) {
        throw new SwissDockAdapterError(
          "FAILED",
          `SwissDock reported failure for session ${sessionNumber}. No poses were invented.`,
        );
      }
    }

    if (isFinishedStatus(statusText) && !isStillRunning(statusText)) {
      this.setProvenance(
        {
          sessionNumber,
          pdbId,
          smiles,
          phase: "ready",
          api: SWISSDOCK_API_BASE,
        },
        retrievedAt,
      );
      return {
        sessionNumber,
        pdbId,
        smiles,
        statusText,
        phase: "ready",
        resultsText: statusText,
      };
    }

    this.setProvenance(
      {
        sessionNumber,
        pdbId,
        smiles,
        phase: "docking",
        api: SWISSDOCK_API_BASE,
      },
      retrievedAt,
    );

    if (allowPending) {
      return {
        sessionNumber,
        pdbId,
        smiles,
        statusText,
        phase: "docking",
        resultsText: null,
      };
    }
    throw new SwissDockAdapterError(
      "PENDING",
      `SwissDock session ${sessionNumber} is still running.`,
    );
  }

  normalize(output: SwissDockRawPayload): SwissDockNormalizedSearch {
    return normalizeSwissDockPayload(output, {
      retrievedAt: this.lastProvenance?.retrievedAt,
      provenance: this.lastProvenance ?? undefined,
    });
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "SwissDock",
        source: SWISSDOCK_PROVENANCE_SOURCE,
        retrievedAt: "",
        parameters: {},
        version: "SwissDock CLI REST (Vina)",
      });
    }
    return this.lastProvenance;
  }
}

export function createSwissDockSearchAdapter(
  options?: SwissDockAdapterOptions,
): SwissDockSearchAdapter {
  return new SwissDockSearchAdapter(options);
}
