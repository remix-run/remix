// This file is used to avoid CJS deprecation warnings in Vite 5 since
// @remix-run/dev currently compiles to CJS. By using this interface, we only
// ever access the Vite package via a dynamic import which forces the ESM build.
// "importViteAsync" is expected be called up-front in the first async plugin
// hook, which then unlocks "importViteEsmSync" for use anywhere in the plugin
// and its utils. This file won't be needed when this package is ESM only.

import path from "pathe";

import invariant from "../invariant";
import { isInRemixMonorepo } from "./is-in-remix-monorepo";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Vite = typeof import("vite");
let vite: Vite | undefined;

export async function preloadViteEsm(): Promise<void> {
  vite = isInRemixMonorepo()
    ? await import(
        `file:///${path.normalize(
          require
            .resolve("vite/package.json", { paths: [process.cwd()] })
            .replace("package.json", "dist/node/index.js")
        )}`
      )
    : await import("vite");
}

export function importViteEsmSync(): Vite {
  invariant(vite, "importViteEsmSync() called before preloadViteEsm()");
  return vite;
}
