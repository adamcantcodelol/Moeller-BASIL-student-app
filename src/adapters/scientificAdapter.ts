import type { Provenance } from "@/types/provenance";
import { ScientificError } from "@/adapters/errors";
import { buildProvenance } from "@/lib/provenance/buildProvenance";

export interface ScientificAdapter<TInput, TOutput, TNormalized> {
  run(input: TInput): Promise<TOutput>;
  normalize(output: TOutput): TNormalized;
  getProvenance(): Provenance;
}

export class ScientificAdapterNotImplementedError extends ScientificError {
  constructor(toolName: string) {
    super(
      "NOT_IMPLEMENTED",
      `${toolName} is not implemented in this phase. The platform will not invent results.`,
    );
    this.name = "ScientificAdapterNotImplementedError";
  }
}

export function createNotImplementedAdapter(
  toolName: string,
): ScientificAdapter<unknown, never, never> {
  return {
    async run(): Promise<never> {
      throw new ScientificAdapterNotImplementedError(toolName);
    },
    normalize(): never {
      throw new ScientificAdapterNotImplementedError(toolName);
    },
    getProvenance(): Provenance {
      return buildProvenance({
        tool: toolName,
        source: "not_implemented",
        retrievedAt: "",
        parameters: {},
        rawResultId: null,
        version: null,
      });
    },
  };
}
