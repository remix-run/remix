import esbuild from "esbuild";

import type { Options, ServerCompiler } from "../../compiler-interface";
import type { ReadChannel } from "../../compiler-interface/channel";
import type { CreateCompiler } from "../../compiler-interface/compiler";
import type { AssetsManifest } from "../../compiler/assets";
import { createEsbuildConfig } from "./config";

export const createServerCompiler: CreateCompiler<ServerCompiler> = (
  remixConfig,
  options: Options
) => {
  let build = async (manifestChannel: ReadChannel<AssetsManifest>) => {
    let esbuildConfig = createEsbuildConfig(
      remixConfig,
      manifestChannel,
      options
    );
    await esbuild.build(esbuildConfig);
  };
  return {
    build,
    dispose: () => undefined,
  };
};
