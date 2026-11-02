// Apple app-specific credentials are 16 letters. Paste separators are cosmetic;
// validate the complete value before canonicalizing it for the Apple request.
export function normalizeAppleAppPassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 128) return null;
  const letters = value.replace(/[\s\-\u2010-\u2015]/g, "");
  if (!/^[a-z]{16}$/i.test(letters)) return null;
  return letters.toLowerCase().match(/.{4}/g)!.join("-");
}
