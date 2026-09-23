export {
  createFoldseekSearchAdapter,
  FoldseekSearchAdapter,
} from "@/adapters/foldseek/foldseekAdapter";
export {
  normalizeFoldseekPayload,
  buildFoldseekProvenance,
} from "@/adapters/foldseek/normalize";
export type {
  FoldseekFetchInput,
  FoldseekNormalizedSearch,
  FoldseekHitNormalized,
  FoldseekRawPayload,
} from "@/adapters/foldseek/types";
export { FoldseekAdapterError } from "@/adapters/foldseek/types";
