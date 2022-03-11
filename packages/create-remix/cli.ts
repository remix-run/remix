import { execSync } from "child_process";

import pkgJSON from "./package.json";

async function run() {
  console.log("💿 Welcome to Remix! Let's get you set up with a new project.");
  console.log();

  let args: Array<string> = [
    ...process.argv.slice(2),
    `--remix-version ${pkgJSON.version}`,
  ];

  execSync(`npx @remix-run/dev ${args.join(" ")}`);
  return;
}

run().then(
  () => {
    process.exit(0);
  },
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
