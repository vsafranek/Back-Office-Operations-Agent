import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/config/env";

const PREFIX = "enc:v1";

function getKey(): Buffer {
  const env = getEnv();
  const secret = env.TOKEN_ENCRYPTION_KEY;
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const plaintext = value.trim();
  if (!plaintext) return null;
  if (plaintext.startsWith(`${PREFIX}:`)) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString("base64url")}:${encrypted.toString("base64url")}:${tag.toString("base64url")}`;
}

export function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (!raw.startsWith(`${PREFIX}:`)) {
    return raw;
  }

  const [, version, ivB64, dataB64, tagB64] = raw.split(":");
  if (version !== "v1" || !ivB64 || !dataB64 || !tagB64) {
    throw new Error("Invalid encrypted token format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}
