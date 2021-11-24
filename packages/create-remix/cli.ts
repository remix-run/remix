import * as path from "path";
import { execSync } from "child_process";
import chalkAnimation from "chalk-animation";
import fse from "fs-extra";
import inquirer from "inquirer";
import meow from "meow";

import cliPkgJson from "./package.json";

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

  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      console.log(
        `️🚨 Oops, "${relativeProjectDir}" already exists. Please try again with a different directory.`
      );
      process.exit(1);
    } else {
      await fse.mkdir(projectDir);
    }
  }

  // copy the shared template
  let sharedTemplate = path.resolve(
    __dirname,
    "templates",
    `_shared_${answers.lang}`
  );
  await fse.copy(sharedTemplate, projectDir);

  // copy the server template
  let serverTemplate = path.resolve(__dirname, "templates", answers.server);
  if (fse.existsSync(serverTemplate)) {
    await fse.copy(serverTemplate, projectDir, { overwrite: true });
  }

  let serverLangTemplate = path.resolve(
    __dirname,
    "templates",
    `${answers.server}_${answers.lang}`
  );
  if (fse.existsSync(serverLangTemplate)) {
    await fse.copy(serverLangTemplate, projectDir, { overwrite: true });
  }

  // rename dotfiles
  await fse.move(
    path.join(projectDir, "gitignore"),
    path.join(projectDir, ".gitignore")
  );

  // merge package.jsons
  let appPkg = require(path.join(sharedTemplate, "package.json"));
  let serverPkg = require(path.join(serverTemplate, "package.json"));
  ["dependencies", "devDependencies", "scripts"].forEach(key => {
    Object.assign(appPkg[key], serverPkg[key]);
  });

  appPkg.main = serverPkg.main;

  // add current versions of remix deps
  ["dependencies", "devDependencies"].forEach(pkgKey => {
    for (let key in appPkg[pkgKey]) {
      if (appPkg[pkgKey][key] === "*") {
        appPkg[pkgKey][key] = `^${cliPkgJson.version}`;
      }
    }
  });

  // write package.json
  await fse.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify(appPkg, null, 2)
  );

  if (answers.install) {
    execSync("npm install", { stdio: "inherit", cwd: projectDir });
  }

  if (projectDirIsCurrentDir) {
    console.log(
      `💿 That's it! Check the README for development and deploy instructions!`
    );
  } else {
    console.log(
      `💿 That's it! \`cd\` into "${path.relative(
        process.cwd(),
        projectDir
      )}" and check the README for development and deploy instructions!`
    );
  }
}

type Server =
  | "arc"
  | "cloudflare-workers"
  | "express"
  | "fly"
  | "netlify"
  | "remix"
  | "vercel";
