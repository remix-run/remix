import esbuild from "esbuild";

import type { Options, ServerCompiler } from "../../compiler-kit";
import type { ReadChannel } from "../../compiler-kit/utils/channel";
import type { CreateCompiler } from "../../compiler-kit/interface";
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
