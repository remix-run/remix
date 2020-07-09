import path from "path";
import { promises as fsp } from "fs";
import { fileURLToPath } from "url";

import { exec } from "./utils.js";

const dirname = fileURLToPath(import.meta.url);
const packagesDir = path.resolve(dirname, "../packages");

async function test(args) {
  let target = args[0];

  if (target) {
    if (target === "remix") {
      target = "packages/remix";
    } else if (target.startsWith("@remix-run/")) {
      target = target.replace(/^@remix-run\//, "packages/@remix-run-");
    } else {
      let dirs = await fsp.readdir(packagesDir);
      if (dirs.includes(`@remix-run-${target}`)) {
        target = `packages/@remix-run-${target}`;
      } else {
        throw new Error(`Cannot run tests for ${target}`);
      }
    }
  } else {
    target = "packages/*";
  }

  await exec(`jest --projects ${target}`);

  return 0;
}

test(process.argv.slice(2)).then(code => {
  process.exit(code);
});
