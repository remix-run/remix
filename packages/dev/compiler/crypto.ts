import { createHash } from "crypto";
import type { OutputBundle } from "rollup";

export function getHash(source: Buffer | string, length?: number): string {
  let hash = createHash("sha1").update(source).digest("hex");
  return length ? hash.slice(0, length) : hash;
}

export function addHash(fileName: string, hash: string): string {
  return fileName.replace(/(\.\w+)?$/, `-${hash}$1`);
}

export function getBundleHash(bundle: OutputBundle): string {
  let hash = createHash("sha1");

  for (let key of Object.keys(bundle).sort()) {
    let output = bundle[key];
    hash.update(output.type === "asset" ? output.source : output.code);
  }

  return hash.digest("hex");
}
