import fs from "fs";
import path from "path";

import type { BuildManifest } from "./rollup/manifest";

/**
 * A manifest of all assets (JavaScript, CSS, etc.) in the browser build.
 */
export type AssetManifest = BuildManifest;

export const AssetManifestFilename = "asset-manifest.json";

/**
 * Reads the asset manifest from the build on the filesystem.
 */
export function loadAssetManifest(dir: string): AssetManifest {
  return loadJson(path.resolve(dir, AssetManifestFilename));
}

/**
 * A manifest of all modules in the server build.
 */
export type ServerManifest = BuildManifest;

export const ServerManifestFilename = "server-manifest.json";

/**
 * Reads the server manifest from the build on the filesystem.
 */
export function loadServerManifest(dir: string): ServerManifest {
  return loadJson(path.resolve(dir, ServerManifestFilename));
}

function loadJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
