export {
  createSpriteSearchAdapter,
  SpriteSearchAdapter,
} from "@/adapters/sprite/spriteAdapter";
export {
  normalizeSpritePayload,
  buildSpriteProvenance,
} from "@/adapters/sprite/normalize";
export type {
  SpriteFetchInput,
  SpriteNormalizedSearch,
  SpriteHitNormalized,
  SpriteRawPayload,
  SpriteDatabase,
  SpriteResidueNormalized,
} from "@/adapters/sprite/types";
export {
  SpriteAdapterError,
  SPRITE_SAFE_DATABASES,
  DEFAULT_SPRITE_DATABASE,
  SPRITE_API_BASE,
  SPRITE_PROVENANCE_SOURCE,
  isSpriteDatabase,
} from "@/adapters/sprite/types";
