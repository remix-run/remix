import path from "node:path";
import fsp from "fs/promises";
import { read } from "to-vfile";
import { remark } from "remark";
import remarkDefsplit from "remark-defsplit";
import glob from "glob";
import prettier from "prettier";

main();

async function main() {
  let files = glob.sync("**/*.md", {
    absolute: true,
    cwd: path.join(process.cwd(), "./docs"),
  });

  for (let file of files) {
    console.log(`processing ${file}`);
    let result = await remark()
      .use(remarkDefsplit)
      .process(await read(file));

    await fsp.writeFile(
      file,
      prettier.format(result.toString(), { parser: "markdown" })
    );
  }
}
