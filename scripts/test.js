import path from "path";
import { spawn } from "child_process";
import { promises as fsp } from "fs";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(dirname, "../packages");

function jest(args, options) {
  return new Promise((accept, reject) => {
    spawn("jest", args, options).on("close", code => {
      code === 0 ? accept() : reject();
    });
  });
}

async function run(args) {
  let validTargets = await fsp.readdir(packagesDir);
  let targets = args.filter(arg => !arg.startsWith("-"));

  if (targets.length) {
    for (let target of targets) {
      if (!validTargets.includes(target)) {
        throw new Error(`Cannot run tests for ${target}`);
      }
    }
  } else {
    targets = validTargets;
  }

  let projects = targets.map(target => `packages/${target}`);
  let flags = ["--projects"].concat(projects);
  if (args.includes("--watch")) {
    flags.push("--watch");
  }

  await jest(flags, { stdio: "inherit" });
}

run(process.argv.slice(2)).then(
  code => {
    process.exit(code);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
