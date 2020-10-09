import parseFrontMatter from "front-matter";
import mdx from "@mdx-js/mdx";
import type { Plugin } from "rollup";

const imports = `
import React from "react";
import { mdx } from "@mdx-js/react";
`;

let regex = /\.mdx?$/;

interface RemixFrontMatter {
  meta?: { [name: string]: string };
  headers?: { [header: string]: string };
}

export default function mdxTransform(mdxOptions: any): Plugin {
  return {
    name: "mdx",
    async transform(content, filename) {
      if (!regex.test(filename)) {
        return null;
      }

      let {
        body,
        attributes
      }: {
        body: string;
        attributes: RemixFrontMatter;
      } = parseFrontMatter(content);

      let meta;
      if (attributes && attributes.meta) {
        meta = `export function meta() { return ${JSON.stringify(
          attributes.meta
        )}}`;
      }

      let headers;
      if (attributes && attributes.headers) {
        headers = `export function headers() { return ${JSON.stringify(
          attributes.headers
        )}}`;
      }

      let source = await mdx(body, mdxOptions);
      let code = [imports, headers, meta, source].filter(Boolean).join("\n");

      return { code, map: null };
    }
  };
}
