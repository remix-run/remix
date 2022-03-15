import { execSync } from "child_process";
import shellEscape from "shell-escape";

import packageJson from "./package.json";

async function run() {
  console.log("💿 Welcome to Remix! Let's get you set up with a new project.");
  console.log();

  let args: Array<string> = [
    ...process.argv.slice(2),
    // npm requires a `--` to separate the arguments from the script
    `--`,
    `--remix-version ${packageJson.version}`,
  ];

  execSync(
    `npx @remix-run/dev@${packageJson.version} create ${shellEscape(args)}`,
    { stdio: "inherit" }
  );
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
