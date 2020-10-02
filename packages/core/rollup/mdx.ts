import mdx from "@mdx-js/mdx";
import type { Plugin } from "rollup";

const imports = `
import React from 'react'
import { mdx } from '@mdx-js/react'
`;

let regex = /\.mdx?$/;

export default function mdxTransform(): Plugin {
  return {
    name: "mdx",
    async transform(content, filename) {
      if (!regex.test(filename)) {
        return null;
      }

      let js = await mdx(content, {});
      let code = `${imports}\n${js}`;
      // TODO: https://rollupjs.org/guide/en/#transformers says to return null
      // if we don't "move the code" and it'll preserve mappings itself. I dunno
      // what "move the code" means for sure, but I don't think I moved it.
      return { code, map: null };
    }
  };
}
