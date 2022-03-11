import * as path from "path";
import { execSync } from "child_process";
import inquirer from "inquirer";
import meow from "meow";

type Lang = "ts" | "js";

type Server =
  | "arc"
  | "cloudflare-pages"
  | "cloudflare-workers"
  | "deno"
  | "express"
  | "fly"
  | "netlify"
  | "remix"
  | "vercel";

const help = `
  Usage:
    $ npx create-remix [flags...] [<dir>]

  If <dir> is not provided up front you will be prompted for it.

  Flags:
    --help, -h          Show this help message
    --version, -v       Show the version of this script
    --template, -t      The template to use for the app

  Examples:
    $ npx create-remix
    $ npx create-remix --template express-template
    $ npx create-remix --template :username/:repo
    $ npx create-remix --template https://github.com/:username/:repo
    $ npx create-remix --template https://github.com/:username/:repo/tree/:branch
    $ npx create-remix --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
    $ npx create-remix --template https://example.com/remix-stack.tar.gz
    $ npx create-remix --template /my/remix-stack
    $ npx create-remix --template /my/remix-stack.tar.gz
    $ npx create-remix --template file:///Users/michael/michael-stackson.tar.gz
`;

async function run() {
  let { input, flags, showHelp, showVersion, pkg } = meow(help, {
    flags: {
      help: { type: "boolean", default: false, alias: "h" },
      version: { type: "boolean", default: false, alias: "v" },
      template: { type: "string", alias: "t" },
    },
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();

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
              default: "./my-remix-app",
            },
          ])
        ).dir
  );

  let answers = await inquirer.prompt<{
    server: Server;
    lang: Lang;
    install: boolean;
  }>([
    {
      name: "server",
      type: "list",
      when() {
        return flags.template === undefined;
      },
      message: `Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets.`,
      loop: false,
      choices: [
        { name: "Remix App Server", value: "remix" },
        { name: "Express Server", value: "express" },
        { name: "Architect (AWS Lambda)", value: "arc" },
        { name: "Fly.io", value: "fly" },
        { name: "Netlify", value: "netlify" },
        { name: "Vercel", value: "vercel" },
        { name: "Cloudflare Pages", value: "cloudflare-pages" },
        { name: "Cloudflare Workers", value: "cloudflare-workers" },
        { name: "Deno (experimental)", value: "deno" },
      ],
    },
    {
      name: "lang",
      type: "list",
      message: "TypeScript or JavaScript?",
      choices: [
        { name: "TypeScript", value: "ts" },
        { name: "JavaScript", value: "js" },
      ],
    },
    {
      name: "install",
      type: "confirm",
      message: "Do you want me to run `npm install`?",
      default: true,
    },
  ]);

  let args: Array<string> = [
    projectDir,
    `--template ${answers.server ? answers.server : flags.template}`,
    `--remix-version ${pkg.version}`,
  ];

  if (!answers.install) {
    args.push("--no-install");
  }

  if (answers.lang === "js") {
    args.push("--no-typescript");
  }

  execSync(`npx @remix-run/dev ${args.join(" ")}`);
  return;
}

run().then(
  () => {
    process.exit(0);
  },
  (error: Error) => {
    console.error(error);
    process.exit(1);
  }
);
