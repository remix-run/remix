import type { RemixConfig } from "../config";
import type { CompileOptions } from "./options";
import * as Compiler from "./compiler";

export async function build(
  config: RemixConfig,
  {
    mode = "production",
    target = "node14",
    sourcemap = false,
  }: Partial<CompileOptions> = {}
) {
  let compiler = await Compiler.create(config, {
    mode,
    target,
    sourcemap,
  });
  return compiler.compile();
}
