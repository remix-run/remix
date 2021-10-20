import * as path from "path";
import { execSync } from "child_process";
import { homedir } from "os";
import chalkAnimation from "chalk-animation";
import fse from "fs-extra";
import inquirer from "inquirer";
import meow from "meow";

import pkgJSON from "./package.json";

const help = `
  Usage:
    $ npx create-remix [flags...] [<dir>]

  If <dir> is not provided up front you will be prompted for it.

  Flags:
    --tag               The version tag of Remix to use, may also be a specific
                        version. Defaults to "latest"
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
      tag: { type: "string", default: "latest" },
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
  let appDir = path.resolve(
    process.cwd(),
    input.length > 0
      ? input[0]
      : (
          await inquirer.prompt([
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
  let relativeAppDir = path.relative(process.cwd(), appDir);
  let appDirIsCurrentDir = relativeAppDir === "";
  if (!appDirIsCurrentDir) {
    if (fse.existsSync(appDir)) {
      console.log(
        `️🚨 Oops, "${relativeAppDir}" already exists. Please try again with a different directory.`
      );
      process.exit(1);
    } else {
      await fse.mkdir(appDir);
    }
  }

  // Make sure npm registry is configured
  if (await hasHomeNpmRegistry()) {
    console.log("💿 Detected Remix Registry in ~/.npmrc");
  } else {
    await writeLocalNpmrc(appDir);
    console.log("💿 Created local .npmrc with Remix Registry");
  }

  // copy the shared template
  let sharedTemplate = path.resolve(
    __dirname,
    "templates",
    `_shared_${answers.lang}`
  );
  await fse.copy(sharedTemplate, appDir);

  // copy the server template
  let serverTemplate = path.resolve(__dirname, "templates", answers.server);
  if (fse.existsSync(serverTemplate)) {
    await fse.copy(serverTemplate, appDir, { overwrite: true });
  }

  let serverLangTemplate = path.resolve(
    __dirname,
    "templates",
    `${answers.server}_${answers.lang}`
  );
  if (fse.existsSync(serverLangTemplate)) {
    await fse.copy(serverLangTemplate, appDir, { overwrite: true });
  }

  // rename dotfiles
  await fse.move(
    path.join(appDir, "gitignore"),
    path.join(appDir, ".gitignore")
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
        appPkg[pkgKey][key] = `^${pkgJSON.version}`;
      }
    }
  });

  // write package.json
  await fse.writeFile(
    path.join(appDir, "package.json"),
    JSON.stringify(appPkg, null, 2)
  );

  if (answers.install) {
    execSync("npm install", { stdio: "inherit" });
  }

  if (appDirIsCurrentDir) {
    console.log(
      `💿 That's it! Check the README for development and deploy instructions!`
    );
  } else {
    console.log(
      `💿 That's it! \`cd\` into "${path.relative(
        process.cwd(),
        appDir
      )}" and check the README for development and deploy instructions!`
    );
  }
}

async function hasHomeNpmRegistry(): Promise<boolean> {
  let npmrcFile = path.resolve(homedir(), ".npmrc");
  if (fse.existsSync(npmrcFile)) {
    let npmrc = (await fse.readFile(npmrcFile)).toString();
    return /@remix-run:registry=https:\/\/npm.remix.run/.test(npmrc);
  }
  return false;
}

async function writeLocalNpmrc(dir: string): Promise<void> {
  let npmrc = `
@remix-run:registry=https://npm.remix.run
`;
  let npmrcFile = path.resolve(dir, ".npmrc");
  return fse.writeFile(npmrcFile, npmrc.trim());
}

type Server =
  | "arc"
  | "cloudflare-workers"
  | "express"
  | "fly"
  | "netlify"
  | "remix"
  | "vercel";
