/**
 * Small AES-GCM "secret box" for settings stored in D1. The key is derived
 * (HMAC-SHA256) from the TEACHER_PASSWORD Worker secret, so a D1 dump alone
 * does not reveal saved API keys. If TEACHER_PASSWORD is rotated, previously
 * saved secrets can no longer be decrypted and must be re-entered.
 * Web Crypto only (Workers + Node).
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const raw = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    encoder.encode("basil-settings-encryption-v1"),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealSecret(plaintext: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(secret),
    encoder.encode(plaintext),
  );
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/** Null when the box is malformed or was sealed with a different secret. */
export async function openSecret(sealed: string, secret: string): Promise<string | null> {
  const [version, ivText, dataText] = sealed.split(":");
  if (version !== "v1" || !ivText || !dataText) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivText) },
      await aesKey(secret),
      fromBase64(dataText),
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}
