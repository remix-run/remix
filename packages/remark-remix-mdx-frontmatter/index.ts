import type { Plugin } from "unified";
import type { Literal, Root } from "mdast";
import type { ExportNamedDeclaration } from "estree";
import { valueToEstree } from "estree-util-value-to-estree";
import { parse as parseToml } from "toml";
import { parse as parseYaml } from "yaml";

type FrontmatterParsers = Record<string, (value: string) => unknown>;

export interface RemarkRemixMdxFrontmatterOptions {
  name?: string;
  parsers?: FrontmatterParsers;
}

export const remarkRemixMdxFrontmatter: Plugin<
  [RemarkRemixMdxFrontmatterOptions?],
  any
> = ({ name: frontmatterExportName = "frontmatter", parsers } = {}) => {
  let allParsers: FrontmatterParsers = {
    toml: parseToml,
    yaml: parseYaml,
    ...parsers,
  };

  return (rootNode: Root, { basename = "" }) => {
    let frontmatter: unknown;

    let node = rootNode.children.find(({ type }) =>
      Object.hasOwnProperty.call(allParsers, type)
    );

    if (node) {
      let parser = allParsers[node.type];
      frontmatter = parser((node as Literal).value);
    }

    let frontmatterHasKey = (key: string): boolean =>
      typeof frontmatter === "object" &&
      frontmatter !== null &&
      key in frontmatter;

    rootNode.children.unshift({
      type: "mdxjsEsm",
      value: "",
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          body: [
            {
              type: "ExportNamedDeclaration",
              specifiers: [],
              declaration: {
                type: "VariableDeclaration",
                kind: "const",
                declarations: [
                  {
                    type: "VariableDeclarator",
                    id: {
                      type: "Identifier",
                      name: frontmatterExportName,
                    },
                    init: valueToEstree(frontmatter),
                  },
                ],
              },
            },
            ...["headers", "meta", "handle"].filter(frontmatterHasKey).map(
              (remixExportName: string): ExportNamedDeclaration => ({
                type: "ExportNamedDeclaration",
                specifiers: [],
                declaration: {
                  type: "VariableDeclaration",
                  kind: "const",
                  declarations: [
                    {
                      type: "VariableDeclarator",
                      id: {
                        type: "Identifier",
                        name: remixExportName,
                      },
                      init: {
                        type: "MemberExpression",
                        optional: false,
                        computed: false,
                        object: {
                          type: "Identifier",
                          name: frontmatterExportName,
                        },
                        property: {
                          type: "Identifier",
                          name: remixExportName,
                        },
                      },
                    },
                  ],
                },
              })
            ),
          ],
        },
      },
    });
  };
};

export default remarkRemixMdxFrontmatter;
