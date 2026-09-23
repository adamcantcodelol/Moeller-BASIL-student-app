export {
  createInterProDataAdapter,
  InterProDataAdapter,
} from "@/adapters/interpro/interproAdapter";
export {
  normalizeInterProPayload,
  buildInterProProvenance,
} from "@/adapters/interpro/normalize";
export type {
  InterProFetchInput,
  InterProNormalizedAnnotation,
  InterProEntryNormalized,
  InterProRawPayload,
} from "@/adapters/interpro/types";
export { InterProAdapterError } from "@/adapters/interpro/types";
