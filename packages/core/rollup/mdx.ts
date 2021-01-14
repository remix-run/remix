import { promises as fsp } from "fs";
import type { Plugin } from "rollup";
import parseFrontMatter from "front-matter";
import mdx from "@mdx-js/mdx";

import { getRemixConfig } from "./remixConfig";

const imports = `
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

/**
 * Loads .mdx files as JavaScript modules with support for Remix's `headers`
 * and `meta` route module functions as static object declarations in the
 * frontmatter.
 */
export default function mdxPlugin(fixedMdxConfig?: MdxConfig): Plugin {
  let mdxConfig = fixedMdxConfig;

  return {
    name: "mdx",
    async buildStart({ plugins }) {
      mdxConfig = fixedMdxConfig || (await getRemixConfig(plugins)).mdx;
    },
    async load(id) {
      if (id.startsWith("\0") || !regex.test(id)) return null;

      let filename = id;
      let content = await fsp.readFile(filename, "utf-8");
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

      return code;
    }
  };
}
