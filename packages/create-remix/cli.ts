import * as path from "path";
import chalkAnimation from "chalk-animation";
import inquirer from "inquirer";
import meow from "meow";

import type { Lang, Server, Stack } from ".";
import { appType } from ".";
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
  let { input, flags, showHelp, showVersion, pkg } = meow(help, {
    flags: {
      help: { type: "boolean", default: false, alias: "h" },
      version: { type: "boolean", default: false, alias: "v" }
    }
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();

  let anim = chalkAnimation.rainbow(`\nR E M I X - v${pkg.version}\n`);
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

  let answers = await inquirer.prompt<
    | {
        appType: "basic";
        stack?: never;
        server: Server;
        lang: Lang;
        install: boolean;
      }
    | {
        appType: "stack";
        stack: Stack;
        server?: never;
        install: boolean;
      }
  >([
    {
      name: "appType",
      type: "list",
      message: "What type of app do you want to create?",
      choices: [
        {
          name: "A pre-configured stack ready for production",
          value: "stack"
        },
        {
          name: "Just the basics",
          value: "basic"
        }
      ]
    },
    {
      name: "stack",
      type: "list",
      message: "Where do you want to deploy your stack?",
      loop: false,
      when(answers) {
        return answers.appType === appType.stack;
      },
      choices: [
        { name: "Fly.io", value: "fly-stack" },
        { name: "Architect (AWS Lambda)", value: "arc-stack" }
      ]
    },
    {
      name: "server",
      type: "list",
      message:
        "Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets.",
      loop: false,
      when(answers) {
        return answers.appType === appType.basic;
      },
      choices: [
        { name: "Remix App Server", value: "remix" },
        { name: "Express Server", value: "express" },
        { name: "Architect (AWS Lambda)", value: "arc" },
        { name: "Fly.io", value: "fly" },
        { name: "Netlify", value: "netlify" },
        { name: "Vercel", value: "vercel" },
        { name: "Cloudflare Pages", value: "cloudflare-pages" },
        { name: "Cloudflare Workers", value: "cloudflare-workers" },
        { name: "Deno (experimental)", value: "deno" }
      ]
    },
    {
      name: "lang",
      type: "list",
      message: "TypeScript or JavaScript?",
      when(answers) {
        return answers.appType === appType.basic;
      },
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

  if (answers.stack) {
    await createApp({
      projectDir,
      lang: "ts",
      stack: answers.stack,
      install: answers.install
    });
  } else {
    await createApp({
      projectDir,
      lang: answers.lang,
      server: answers.server,
      install: answers.install
    });
  }
}
