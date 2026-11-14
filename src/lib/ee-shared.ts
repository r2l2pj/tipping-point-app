// Shared Earth Engine plumbing: the error taxonomy, compute-error mapping,
// a timeout wrapper for callback roundtrips, and a promisified getInfo.
// ee-tiles builds on these; other EE readers can too without a module cycle.
// (The error classes are re-exported by ee-tiles as its public API.)

export class CredsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredsError";
  }
}

// Missing asset / band / date — the route maps this to 404.
export class TileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TileNotFoundError";
  }
}

// Wrapped ee init/compute failure — the route maps this to 502, or to 503
// when the message starts with "timeout" (see withTimeout).
export class TileServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TileServiceError";
  }
}

export const errMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

// EE "object doesn't exist" style failures read as 404s; anything else is a
// compute/transport failure (502 at the route).
export const NOT_FOUND_RE =
  /not found|does not exist|no such|unknown asset|failed to find/i;

export function mapComputeError(err: unknown, context: string): Error {
  const msg = `${context}: ${errMessage(err)}`;
  return NOT_FOUND_RE.test(msg)
    ? new TileNotFoundError(msg)
    : new TileServiceError(msg);
}

// Races `promise` against a timer; a lost race rejects with a tagged
// TileServiceError whose message starts with "timeout" (route → 503).
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new TileServiceError(`timeout after ${ms}ms waiting for ${label}`)
        ),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// The slice of an ee object getInfo payload the app reads.
export interface ImageInfo {
  bands?: { id?: string }[];
  properties?: Record<string, unknown>;
}

interface InfoSource {
  getInfo(callback: (data: unknown, error?: string) => void): void;
}

// Promisified getInfo; EE-side errors go through mapComputeError.
export function imageInfo(
  img: InfoSource,
  context = "getInfo"
): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    try {
      img.getInfo((data, err) => {
        if (err) return reject(mapComputeError(err, context));
        resolve(
          typeof data === "object" && data !== null
            ? (data as ImageInfo)
            : {}
        );
      });
    } catch (e) {
      reject(mapComputeError(e, context));
    }
  });
}
