/** Parse a fetch `Response` as JSON; Safari-friendly errors when the body is HTML (502/504) or invalid. */
export async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(res.ok ? "Empty response from server." : `Request failed (${res.status}).`);
  }
  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    throw new Error(
      res.status === 504
        ? "The server took too long to process your recording. Try again — if it keeps failing, record shorter segments."
        : `Server error (${res.status}). Try again in a moment.`,
    );
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Unexpected response format from server.");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unexpected")) throw e;
    throw new Error(
      res.ok
        ? "Could not read the server response. Try again."
        : `Request failed (${res.status}). Try again.`,
    );
  }
}
