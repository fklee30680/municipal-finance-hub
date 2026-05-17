import { createHash } from "node:crypto";

export function sha256Hex(fileBytes: Buffer | Uint8Array) {
  return createHash("sha256").update(fileBytes).digest("hex");
}
