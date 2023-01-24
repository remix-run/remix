import path from "node:path";
import fsp from "node:fs/promises";
import { read } from "to-vfile";
import { remark } from "remark";
import { remarkDefinitionLinks } from "@mcansh/remark-definition-links";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import glob from "glob";

main();

async function main() {
  let files = glob.sync("**/*.md", {
    absolute: true,
    cwd: path.join(process.cwd(), "./docs"),
  });

  for (let file of files) {
    let result = await remark()
      .use({
        settings: {
          fences: true,
          listItemIndent: "one",
          tightDefinitions: true,
        },
      })
      .use(remarkDefinitionLinks)
      .use(remarkGfm)
      .use(remarkFrontmatter, ["yaml", "toml"])
      .process(await read(file));

    await fsp.writeFile(file, result.toString());
  }
}
