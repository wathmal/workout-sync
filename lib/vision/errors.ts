import "server-only";

export type VisionErrorKind =
  | "config"
  | "format"
  | "rate_limit"
  | "extraction";

export class VisionError extends Error {
  readonly kind: VisionErrorKind;
  readonly cause?: unknown;
  constructor(kind: VisionErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "VisionError";
    this.kind = kind;
    this.cause = cause;
  }
}
