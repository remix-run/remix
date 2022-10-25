import { type BuildOptions } from "../build";
import { type RemixConfig } from "../config";
import { warnOnce } from "./warnings";
import { logCompileFailure } from "./on-compile-failure";
import { compile, createRemixCompiler } from "./remix-compiler";

export async function build(
  config: RemixConfig,
  {
    mode = "production",
    target = "node14",
    sourcemap = false,
    onWarning = warnOnce,
    onBuildFailure = logCompileFailure,
  }: Partial<BuildOptions> = {}
): Promise<void> {
  let compiler = createRemixCompiler(config, {
    mode,
    target,
    sourcemap,
    onWarning,
    onBuildFailure,
  });
  await compile(compiler, { onCompileFailure: onBuildFailure });
}
