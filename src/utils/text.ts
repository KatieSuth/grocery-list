/** Trims and collapses internal whitespace so "  Frozen   Foods " becomes "Frozen Foods". */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function sameName(a: string, b: string): boolean {
  return normalizeText(a).toLocaleLowerCase() === normalizeText(b).toLocaleLowerCase();
}

/** A comparison key: normalized and lowercased, so "  Frozen  foods" and "frozen Foods" match. */
export function nameKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase();
}
