/** UUID v4-style id (legacy SQLite sessions). */
export function isUuidLike(s: string): boolean {
  return (
    s.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}

/** PocketBase auto-generated record id (15 lowercase alphanumeric chars). */
export function isPocketBaseRecordId(s: string): boolean {
  return s.length === 15 && /^[a-z0-9]{15}$/.test(s);
}

/** Session / user id from either SQLite (UUID) or PocketBase. */
export function isRecordId(s: string): boolean {
  return isUuidLike(s) || isPocketBaseRecordId(s);
}
