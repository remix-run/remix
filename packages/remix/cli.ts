import { promises as fsp } from "fs";
import * as path from "path";

function setupFile(name: string, sourcePackage: string) {
  return Promise.all([
    // Write the CommonJS source module
    fsp.writeFile(
      path.resolve(__dirname, `${name}.js`),
      `module.exports = require(${JSON.stringify(sourcePackage)});`
    ),
    // Write the TypeScript declarations file
    fsp.writeFile(
      path.resolve(__dirname, `${name}.d.ts`),
      `export * from ${JSON.stringify(sourcePackage)};`
    )
  ]);
}

async function run(args: string[]) {
  if (!args.length) {
    console.error("Usage: remix-setup client|server=package");
    process.exit(1);
  }

  await Promise.all(
    args.map(pair => {
      let [name, sourcePackage] = pair.split("=", 2);
      return setupFile(name, sourcePackage);
    })
  );
}

run(process.argv.slice(2)).then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
