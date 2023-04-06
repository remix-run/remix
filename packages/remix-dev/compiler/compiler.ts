import { createChannel } from "../channel";
import type { RemixConfig } from "../config";
import { type Manifest } from "../manifest";
import type { CompileOptions } from "./options";
import * as AssetsCompiler from "./assets";
import * as ServerCompiler from "./server";
import { ok, err } from "./result";
import { type Type as Result } from "./result";

type Compiler = {
  compile: () => Promise<
    Result<
      Manifest,
      {
        assetsCss?: unknown;
        assetsJs?: unknown;
        server?: unknown;
      }
    >
  >;
  cancel: () => void;
  dispose: () => void;
};
export type Type = Compiler;

export let create = async (
  config: RemixConfig,
  options: CompileOptions
): Promise<Compiler> => {
  let channels = {
    manifest: createChannel<Manifest>(),
  };

  let compiler = {
    assets: await AssetsCompiler.create(config, options, channels),
    server: await ServerCompiler.create(config, options, channels),
  };
  let cancel = async () => {
    await compiler.assets.cancel();
    await compiler.server.cancel();
  };
  return {
    compile: async () => {
      channels.manifest = createChannel();

      let [assets, server] = await Promise.all([
        compiler.assets.compile(),
        compiler.server.compile(),
      ]);

      if (!assets.ok || !server.ok) {
        let errors: Record<string, unknown> = {};
        if (!assets.ok) errors.assets = assets.error;
        if (!server.ok) errors.server = server.error;
        return err(errors);
      }

      return ok(assets.value);
    },
    cancel,
    dispose: () => {
      compiler.assets.dispose();
      compiler.server.dispose();
    },
  };
};
