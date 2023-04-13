import * as Channel from "./utils/channel";
import { type Result } from "./utils/result";
import { ok, err } from "./utils/result";
import { type Manifest } from "../manifest";
import * as AssetsCompiler from "./assets";
import type { Context } from "./context";
import * as ServerCompiler from "./server";

type Err = {
  assetsCss?: unknown;
  assetsJs?: unknown;
  server?: unknown;
};

export type T = {
  compile: () => Promise<Result<Manifest, Err>>;
  dispose: () => Promise<void>;
};

export let create = async (ctx: Context): Promise<T> => {
  let channels = {
    manifest: Channel.create<Manifest>(),
  };

  let compiler = {
    assets: await AssetsCompiler.create(ctx, channels),
    server: await ServerCompiler.create(ctx, channels),
  };

  return {
    compile: async () => {
      channels.manifest = Channel.create();

      let [assets, server] = await Promise.all([
        compiler.assets.compile(),
        compiler.server.compile(),
      ]);

      if (!assets.ok || !server.ok) {
        let errors: Err = {};
        if (!assets.ok) {
          errors.assetsCss = assets.error.css;
          errors.assetsJs = assets.error.js;
        }
        if (!server.ok) errors.server = server.error;
        return err(errors);
      }

      return ok(assets.value);
    },
    dispose: async () => {
      await Promise.all([compiler.assets.dispose(), compiler.server.dispose()]);
    },
  };
};
