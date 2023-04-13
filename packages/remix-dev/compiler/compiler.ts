import * as Channel from "./utils/channel";
import { type Manifest } from "../manifest";
import * as AssetsCompiler from "./assets";
import type { Context } from "./context";
import * as ServerCompiler from "./server";

type Compiler = {
  compile: () => Promise<Manifest | undefined>;
  dispose: () => Promise<void>;
};

export let create = async (ctx: Context): Promise<Compiler> => {
  let channels = {
    manifest: Channel.create<Manifest>(),
  };

  let assets = await AssetsCompiler.create(ctx, channels);
  let server = await ServerCompiler.create(ctx, channels);
  return {
    compile: async () => {
      channels.manifest = Channel.create();
      try {
        let [manifest] = await Promise.all([
          assets.compile(),
          server.compile(),
        ]);

        return manifest;
      } catch (error: unknown) {
        ctx.options.onCompileFailure?.(error as Error);
        return undefined;
      }
    },
    dispose: async () => {
      await Promise.all([assets.dispose(), server.dispose()]);
    },
  };
};
