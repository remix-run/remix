import * as Compiler from "./compiler";
import type { Context } from "./context";

export async function build(ctx: Context) {
  let compiler = await Compiler.create(ctx);
  return compiler.compile();
}
