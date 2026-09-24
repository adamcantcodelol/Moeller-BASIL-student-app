import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { appSettings } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { openSecret, sealSecret } from "@/lib/settings/secretBox";
import {
  createGroqProvider,
  createOpenRouterProvider,
  readShannonBotEnvKeys,
  resolveShannonBotProviders,
  type LlmProvider,
  type ShannonBotEnvKeys,
  type ShannonBotLlmProviderId,
} from "@/ai/providers";

/** Providers ShannonBot actually supports (see src/ai/providers). */
export const AI_KEY_PROVIDERS: ShannonBotLlmProviderId[] = ["groq", "openrouter"];

export const AI_PROVIDER_LABELS: Record<ShannonBotLlmProviderId, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
};

function settingKey(provider: ShannonBotLlmProviderId) {
  return `ai_key_${provider}`;
}

interface StoredKey {
  sealed: string;
  last4: string;
}

export interface SavedKeyStatus {
  provider: ShannonBotLlmProviderId;
  saved: boolean;
  masked: string | null;
  updatedAt: string | null;
  /** False when the stored key can't be decrypted (e.g. TEACHER_PASSWORD changed). */
  readable: boolean;
  /** Whether a Worker secret/env key exists for this provider (value never exposed). */
  envKeyConfigured: boolean;
}

export type SavedAiKeys = Partial<Record<ShannonBotLlmProviderId, string>>;

export function isAiKeyProvider(value: unknown): value is ShannonBotLlmProviderId {
  return value === "groq" || value === "openrouter";
}

export function maskKey(last4: string): string {
  return `••••${last4}`;
}

/** Light sanity check so an obviously wrong paste gets a clear message. */
export function validateAiKey(
  provider: ShannonBotLlmProviderId,
  apiKey: string,
): string | null {
  if (apiKey.length < 12 || apiKey.length > 400 || /\s/.test(apiKey)) {
    return "That doesn't look like an API key (no spaces; paste the whole key).";
  }
  if (provider === "groq" && apiKey.startsWith("sk-or-")) {
    return "That looks like an OpenRouter key. Choose OpenRouter as the provider.";
  }
  if (provider === "openrouter" && apiKey.startsWith("gsk_")) {
    return "That looks like a Groq key. Choose Groq as the provider.";
  }
  return null;
}

/**
 * Secret used to encrypt saved keys: the TEACHER_PASSWORD Worker secret.
 * Reads the Cloudflare env when available, else process.env (tests/Node).
 */
export async function getSettingsSecret(): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const value = (env as { TEACHER_PASSWORD?: string }).TEACHER_PASSWORD;
    if (value) return value;
  } catch {
    // not running inside the Worker (unit tests)
  }
  const fallback = process.env.TEACHER_PASSWORD;
  return fallback && fallback.length > 0 ? fallback : undefined;
}

async function readStored(db: AppDatabase) {
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, AI_KEY_PROVIDERS.map(settingKey)));
  const out = new Map<ShannonBotLlmProviderId, { stored: StoredKey; updatedAt: string }>();
  for (const provider of AI_KEY_PROVIDERS) {
    const row = rows.find((r) => r.key === settingKey(provider));
    if (!row) continue;
    try {
      const stored = JSON.parse(row.value) as StoredKey;
      if (stored && typeof stored.sealed === "string") {
        out.set(provider, { stored, updatedAt: row.updatedAt });
      }
    } catch {
      // ignore malformed row
    }
  }
  return out;
}

export async function saveAiKey(
  db: AppDatabase,
  provider: ShannonBotLlmProviderId,
  apiKey: string,
  secret: string,
): Promise<void> {
  const value: StoredKey = {
    sealed: await sealSecret(apiKey, secret),
    last4: apiKey.slice(-4),
  };
  const updatedAt = nowIso();
  await db
    .insert(appSettings)
    .values({ key: settingKey(provider), value: JSON.stringify(value), updatedAt })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(value), updatedAt },
    });
}

export async function removeAiKey(
  db: AppDatabase,
  provider: ShannonBotLlmProviderId,
): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, settingKey(provider)));
}

/** Decrypted teacher-saved keys (server-side only; never send to the browser). */
export async function loadSavedAiKeys(
  db: AppDatabase,
  secret: string | undefined,
): Promise<SavedAiKeys> {
  if (!secret) return {};
  const stored = await readStored(db);
  const keys: SavedAiKeys = {};
  for (const [provider, { stored: value }] of stored) {
    const plain = await openSecret(value.sealed, secret);
    if (plain) keys[provider] = plain;
  }
  return keys;
}

export async function getAiKeyStatus(
  db: AppDatabase,
  secret: string | undefined,
  envKeys: ShannonBotEnvKeys = readShannonBotEnvKeys(),
): Promise<SavedKeyStatus[]> {
  const stored = await readStored(db);
  const statuses: SavedKeyStatus[] = [];
  for (const provider of AI_KEY_PROVIDERS) {
    const entry = stored.get(provider);
    const readable =
      entry && secret ? (await openSecret(entry.stored.sealed, secret)) !== null : false;
    statuses.push({
      provider,
      saved: Boolean(entry),
      masked: entry ? maskKey(entry.stored.last4) : null,
      updatedAt: entry?.updatedAt ?? null,
      readable: entry ? readable : true,
      envKeyConfigured:
        provider === "groq"
          ? Boolean(envKeys.groqApiKey || envKeys.shannonBotApiKey)
          : Boolean(envKeys.openRouterApiKey),
    });
  }
  return statuses;
}

function providerFor(
  provider: ShannonBotLlmProviderId,
  apiKey: string,
  envKeys: ShannonBotEnvKeys,
  fetchImpl?: typeof fetch,
): LlmProvider {
  return provider === "groq"
    ? createGroqProvider({ apiKey, model: envKeys.groqModel ?? undefined, fetchImpl })
    : createOpenRouterProvider({
        apiKey,
        model: envKeys.openRouterModel ?? undefined,
        fetchImpl,
      });
}

/**
 * Ordered ShannonBot providers: teacher-saved keys first (Groq, then
 * OpenRouter), then any Worker secret/env keys as fallback.
 */
export function buildShannonBotProviders(
  saved: SavedAiKeys,
  envKeys: ShannonBotEnvKeys = readShannonBotEnvKeys(),
  fetchImpl?: typeof fetch,
): LlmProvider[] {
  const providers: LlmProvider[] = [];
  const order: ShannonBotLlmProviderId[] =
    envKeys.preferredProvider === "openrouter" ? ["openrouter", "groq"] : ["groq", "openrouter"];
  for (const id of order) {
    const key = saved[id];
    if (key) providers.push(providerFor(id, key, envKeys, fetchImpl));
  }
  const envFallback: ShannonBotEnvKeys = {
    ...envKeys,
    // Skip env keys identical to a saved key (no point retrying the same key).
    groqApiKey: envKeys.groqApiKey === saved.groq ? null : envKeys.groqApiKey,
    shannonBotApiKey:
      envKeys.shannonBotApiKey === saved.groq ? null : envKeys.shannonBotApiKey,
    openRouterApiKey:
      envKeys.openRouterApiKey === saved.openrouter ? null : envKeys.openRouterApiKey,
  };
  providers.push(...resolveShannonBotProviders(envFallback, fetchImpl));
  return providers;
}

/** Provider used by the teacher "Test key" button: saved key, else env key. */
export function providerForTest(
  provider: ShannonBotLlmProviderId,
  saved: SavedAiKeys,
  envKeys: ShannonBotEnvKeys = readShannonBotEnvKeys(),
  fetchImpl?: typeof fetch,
): { provider: LlmProvider; source: "saved" | "env" } | null {
  const savedKey = saved[provider];
  if (savedKey) return { provider: providerFor(provider, savedKey, envKeys, fetchImpl), source: "saved" };
  const envKey =
    provider === "groq"
      ? (envKeys.groqApiKey ?? envKeys.shannonBotApiKey)
      : envKeys.openRouterApiKey;
  if (envKey) return { provider: providerFor(provider, envKey, envKeys, fetchImpl), source: "env" };
  return null;
}
