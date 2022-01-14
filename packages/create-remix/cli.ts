import * as path from "path";
import chalkAnimation from "chalk-animation";
import inquirer from "inquirer";
import meow from "meow";

import type { Server } from ".";
import { createApp } from ".";

const help = `
  Usage:
    $ npx create-remix [flags...] [<dir>]

  If <dir> is not provided up front you will be prompted for it.

  Flags:
    --help, -h          Show this help message
    --version, -v       Show the version of this script
`;

run().then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);

async function run() {
  let { input, flags, showHelp, showVersion } = meow(help, {
    flags: {
      help: { type: "boolean", default: false, alias: "h" },
      version: { type: "boolean", default: false, alias: "v" }
    }
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();

  let anim = chalkAnimation.rainbow(`\nR E M I X\n`);
  await new Promise(res => setTimeout(res, 1500));
  anim.stop();

  console.log("💿 Welcome to Remix! Let's get you set up with a new project.");
  console.log();

  // Figure out the app directory
  let projectDir = path.resolve(
    process.cwd(),
    input.length > 0
      ? input[0]
      : (
          await inquirer.prompt<{ dir: string }>([
            {
              type: "input",
              name: "dir",
              message: "Where would you like to create your app?",
              default: "./my-remix-app"
            }
          ])
        ).dir
  );

  let answers = await inquirer.prompt<{
    server: Server;
    lang: "ts" | "js";
    install: boolean;
  }>([
    {
      name: "server",
      type: "list",
      message:
        "Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets.",
      loop: false,
      choices: [
        { name: "Remix App Server", value: "remix" },
        { name: "Express Server", value: "express" },
        { name: "Architect (AWS Lambda)", value: "arc" },
        { name: "Fly.io", value: "fly" },
        { name: "Netlify", value: "netlify" },
        { name: "Vercel", value: "vercel" },
        { name: "Cloudflare Pages", value: "cloudflare-pages" },
        { name: "Cloudflare Workers", value: "cloudflare-workers" }
      ]
    },
    {
      name: "lang",
      type: "list",
      message: "TypeScript or JavaScript?",
      choices: [
        { name: "TypeScript", value: "ts" },
        { name: "JavaScript", value: "js" }
      ]
    },
    {
      name: "install",
      type: "confirm",
      message: "Do you want me to run `npm install`?",
      default: true
    }
  ]);

  createApp({
    projectDir,
    lang: answers.lang,
    server: answers.server,
    install: answers.install
  });
}
