// Which image-source failures are kept for the life of the page.
//
// MapLibre reports a failed frame with an error that carries the HTTP status.
// A 4xx answer (the file is not published) will not change on a retry, so the
// URL is skipped from then on. A status of 0 or no status is a network or
// CORS failure: it says nothing about the file, so the frame is tried again
// the next time its day is shown.
export function isPermanentFrameFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}
