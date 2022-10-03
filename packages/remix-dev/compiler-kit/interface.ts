import type { AssetsManifest } from "../compiler/assets";
import type { RemixConfig } from "../config";
import type { ReadChannel, WriteChannel } from "./utils/channel";
import type { Options } from "./options";

// TODO explain that `build` will be incremental (i.e. reuse compiler) if run multiple times

export interface BrowserCompiler {
  // produce ./public/build/
  build: (manifestChannel: WriteChannel<AssetsManifest>) => Promise<void>;
  dispose: () => void;
}
export interface ServerCompiler {
  // produce ./build/index.js
  build: (manifestChannel: ReadChannel<AssetsManifest>) => Promise<void>;
  dispose: () => void;
}
export type CreateCompiler<T extends BrowserCompiler | ServerCompiler> = (
  remixConfig: RemixConfig,
  options: Options
) => T;

export interface RemixCompiler {
  browser: BrowserCompiler;
  server: ServerCompiler;
}
