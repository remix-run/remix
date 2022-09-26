import type { AssetsManifest } from "../compiler/assets";
import type { RemixConfig } from "../config";
import type { ReadChannel, WriteChannel } from "./channel";

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
  config: RemixConfig
) => T;

export interface RemixCompiler {
  browser: BrowserCompiler;
  server: ServerCompiler;
}

export const dispose = ({ browser, server }: RemixCompiler) => {
  browser.dispose();
  server.dispose();
};
