import * as Channel from "./utils/channel";
import { type Result } from "./utils/result";
import { ok, err } from "./utils/result";
import type { RemixConfig } from "../config";
import { type Manifest } from "../manifest";
import type { CompileOptions } from "./options";
import * as AssetsCompiler from "./assets";
import * as ServerCompiler from "./server";

export type Type = {
  compile: () => Promise<Result<Manifest>>;
  dispose: () => Promise<void>;
};

export let create = async (
  config: RemixConfig,
  options: CompileOptions
): Promise<Type> => {
  let channels = {
    manifest: Channel.create<Manifest>(),
  };

  let compiler = {
    assets: await AssetsCompiler.create(config, options, channels),
    server: await ServerCompiler.create(config, options, channels),
  };

  return {
    compile: async () => {
      channels.manifest = Channel.create();
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
    dispose: async () => {
      await Promise.all([
        await compiler.assets.dispose(),
        await compiler.server.dispose(),
      ]);
    },
  };
};
