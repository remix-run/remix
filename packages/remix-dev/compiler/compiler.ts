import type { RemixConfig } from "../config";
import { type Manifest } from "../manifest";
import * as ServerJS from "./serverjs";
import type { CompileOptions } from "./options";
import * as AssetsCompiler from "./assets";

type Compiler = {
  compile: () => Promise<Manifest | undefined>;
  dispose: () => void;
};

export let create = async (
  config: RemixConfig,
  options: CompileOptions
): Promise<Compiler> => {
  let assets = await AssetsCompiler.create(config, options);
  let server = ServerJS.compiler.create(config, options);
  return {
    compile: async () => {
      try {
        let manifest = await assets.compile();
        await server.compile(manifest);

        return manifest;
      } catch (error: unknown) {
        options.onCompileFailure?.(error as Error);
        return undefined;
      }
    },
    dispose: () => {
      assets.dispose();
      server.dispose();
    },
  };
};
