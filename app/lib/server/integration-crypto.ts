import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY ?? process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw Error("integration_key_missing");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "hex"), "family-hub", "private-integrations-v1", 32));
}
export function integrationEncryptionReady() { try { key(); return true; } catch { return false; } }
export function encryptConfig(value: unknown, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return "v1." + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function decryptConfig<T>(value: string, context: string): T {
  if (!value.startsWith("v1.")) throw Error("invalid_config");
  const bytes = Buffer.from(value.slice(3), "base64url");
  const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
}
