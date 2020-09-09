import * as rollup from "rollup";

import type { CompilerMode } from "./createCompilerInputOptions";
import createCompilerInputOptions from "./createCompilerInputOptions";

export interface BuildOptions {
  mode: CompilerMode;
  outputDir: string;
  sourceDir: string;
}

export default async function build({
  mode = "production",
  outputDir = "./build",
  sourceDir
}: Partial<BuildOptions> = {}) {
  let compilerOptions = createCompilerInputOptions({ mode, sourceDir });

  let build = await rollup.rollup(compilerOptions);

  await build.write({
    dir: outputDir,
    format: "esm"
  });
}
