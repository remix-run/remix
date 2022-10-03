import fs from "fs";
import path from "path";

import type { AssetsManifest } from "../compiler/assets";
import type { RemixConfig } from "../config";
import { createChannel } from "./utils/channel";
import type { RemixCompiler } from "./interface";

// TODO error handling for if browser/server builds fail (e.g. syntax error)
// enumerate different types of errors
// console.log hints for users if we know how to diagnose the error from experience
// consider throwing custom Remix-specific error type if its an error we know more stuff about

/**
 * Coordinate the hand-off of the asset manifest between the browser and server builds.
 * Additionally, write the asset manifest to the file system.
 */
export const build = async (
  config: RemixConfig,
  compiler: RemixCompiler
): Promise<void> => {
  let manifestChannel = createChannel<AssetsManifest>();
  let browser = compiler.browser.build(manifestChannel);

  // write manifest
  manifestChannel.read().then((manifest) => {
    fs.mkdirSync(config.assetsBuildDirectory, { recursive: true });
    fs.writeFileSync(
      path.resolve(config.assetsBuildDirectory, path.basename(manifest.url!)),
      `window.__remixManifest=${JSON.stringify(manifest)};`
    );
  });

  let server = compiler.server.build(manifestChannel);
  await Promise.all([browser, server]);
};
