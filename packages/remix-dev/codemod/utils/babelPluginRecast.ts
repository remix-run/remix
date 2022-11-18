import type Babel from "@babel/core";
import type { File } from "@babel/types";
import * as recast from "recast";

import type { PluginObj } from "./babel";

function parse(
  code: string,
  options: Babel.ParserOptions,
  parse: (code: string, options: Babel.ParserOptions) => File
): File {
  return recast.parse(code, {
    parser: {
      parse(code: string) {
        return parse(code, { ...options, tokens: true });
      },
    },
  });
}

function generate(ast: File): { code: string; map?: object } {
  return recast.print(ast);
}

/**
 * Adapted from [@codemod/core](https://github.com/codemod-js/codemod/blob/5a9fc6968409613eefd87e646408c08b6dad0c40/packages/core/src/RecastPlugin.ts)
 */
export default function (): PluginObj {
  return {
    parserOverride: parse,
    generatorOverride: generate,
  };
}
