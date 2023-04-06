import type { RemixConfig } from "../config";
import type { CompileOptions } from "./options";
import * as Compiler from "./compiler";
import * as Logger from "./logger";

export async function build(
  config: RemixConfig,
  {
    mode = "production",
    target = "node14",
    sourcemap = false,
    logger = Logger.create(),
  }: Partial<CompileOptions> = {}
): Promise<void> {
  let compiler = await Compiler.create(config, {
    mode,
    target,
    sourcemap,
    logger,
  });
  let result = await compiler.compile();
  if (!result.ok) {
    // TODO: throw Remix-specific error
    throw Error(JSON.stringify(result.error, undefined, 2));
  }
}
