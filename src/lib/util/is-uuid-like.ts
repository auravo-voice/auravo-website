/** Loose UUID v4-style check for practice_session ids (anonymous local MVP). */
export function isUuidLike(s: string): boolean {
  return (
    s.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
}
