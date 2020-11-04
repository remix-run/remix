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

// They don't have types, so we could go figure it all out and add it as an
// interface here
export type MdxOptions = any;
export type MdxFunctionOption = (
  attributes: { [key: string]: any },
  filename: string
) => MdxOptions;

export type MdxConfig = MdxFunctionOption | MdxOptions;

export default function mdxTransform(mdxConfig?: MdxConfig): Plugin {
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

      let mdxOptions =
        typeof mdxConfig === "function"
          ? mdxConfig(attributes, filename)
          : mdxConfig;

      let source = await mdx(body, mdxOptions);
      let code = [imports, headers, meta, source].filter(Boolean).join("\n");

      return { code, map: null };
    }
  };
}
