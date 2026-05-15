// Envelope encryption for adapter configs.
// Master key is read from ADAPTER_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
// Each encrypted value is: iv(12 bytes) + ciphertext + authTag(16 bytes), base64-encoded.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getMasterKey(): Buffer {
  const hex = process.env.ADAPTER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ADAPTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export async function encryptAdapterConfig(config: Record<string, unknown>): Promise<string> {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(config);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

export async function decryptAdapterConfig(
  encryptedBase64: string
): Promise<Record<string, unknown>> {
  const key = getMasterKey();
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
