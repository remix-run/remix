import { type RemixConfig } from "../config";
import { warnOnce } from "./warnings";
import { logCompileFailure } from "./on-compile-failure";
import { type CompileOptions } from "./options";
import { compile, createRemixCompiler } from "./remix-compiler";

export async function build(
  config: RemixConfig,
  {
    mode = "production",
    target = "node14",
    sourcemap = false,
    onWarning = warnOnce,
    onBuildFailure = logCompileFailure,
  }: Partial<CompileOptions> = {}
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
