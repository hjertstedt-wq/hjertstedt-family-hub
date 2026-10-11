import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error("Missing 32-byte token encryption key");
  return Buffer.from(secret, "hex");
}

export function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function unseal(value: string): string {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29) throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
