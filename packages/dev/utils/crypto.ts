import type { BinaryLike } from "crypto";
import { createHash } from "crypto";

export function getHash(source: BinaryLike): string {
  return createHash("sha1").update(source).digest("hex");
}
