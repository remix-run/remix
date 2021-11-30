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
    --server-type, -s  Server template to use (built-in, package id, or path)
                       Built-ins include: remix, express, arc, fly, netlify,
                       vercel, and cloudflare-workers. Any custom package or
                       path may be used that contains templates. Refer to
                       https://remix.run/docs/en/v1/other-api/adapter for more
                       info
    --help, -h         Show this help message
    --version, -v      Show the version of this script

  Examples:
    # Create a new remix app
    $ npx create-remix

    # Create a new remix app in a specific directory
    $ npx create-remix ./awesome

    # Create a new remix app using remix server
    $ npx create-remix -s remix

    # Create a new remix app using a custom server template
    $ npx create-remix -s @mycool/remix-server-thingy
`;

run().then(() => {
  process.exit(0);
}, die);

async function run() {
  let { input, flags, showHelp, showVersion } = meow(help, {
    flags: {
      serverType: { type: "string", alias: "s" },
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
    server: ServerTemplateType;
    customServer: string;
    lang: "ts" | "js";
    install: boolean;
  }>([
    {
      name: "server",
      type: "list",
      message:
        "Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets.",
      loop: false,
      choices: ServerTemplateTypes,
      when: () => flags.serverType == null
    },
    {
      name: "customServer",
      type: "input",
      message:
        "Enter a package or path containing your custom server templates.",
      when: ({ server }) => server === CUSTOM_SERVER_TEMPLATE
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

  let server = flags.serverType ?? answers.server;
  let serverTemplate: string;
  let serverLangTemplate: string;

  if (isOfficialServerTemplateType(server)) {
    serverTemplate = path.resolve(__dirname, "templates", server);
    serverLangTemplate = path.resolve(
      __dirname,
      "templates",
      `${server}_${answers.lang}`
    );
  } else {
    let customServer = flags.serverType ?? answers.customServer;
    let serverTemplateBasePath = resolveServerTemplate(customServer);
    serverTemplate = path.join(serverTemplateBasePath, "templates", "shared");
    serverLangTemplate = path.join(
      serverTemplateBasePath,
      "templates",
      answers.lang
    );
  }

  // Create the app directory
  let relativeProjectDir = path.relative(process.cwd(), projectDir);
  let projectDirIsCurrentDir = relativeProjectDir === "";
  if (!projectDirIsCurrentDir) {
    if (fse.existsSync(projectDir)) {
      die(
        `️🚨 Oops, "${relativeProjectDir}" already exists. Please try again with a different directory.`
      );
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
  if (fse.existsSync(serverTemplate)) {
    await fse.copy(serverTemplate, projectDir, { overwrite: true });
  }

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
  for (let templateDir of [serverTemplate, serverLangTemplate]) {
    if (!fse.existsSync(path.join(templateDir, "package.json"))) continue;

    let serverPkg = require(path.join(templateDir, "package.json"));
    ["dependencies", "devDependencies", "scripts"].forEach(key => {
      Object.assign(appPkg[key], serverPkg[key]);
    });

    if (serverPkg.main) {
      appPkg.main = serverPkg.main;
    }
  }

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

function resolveServerTemplate(packageIdOrPath: string): string {
  let serverTemplateBasePath = fse.existsSync(packageIdOrPath)
    ? path.resolve(packageIdOrPath)
    : resolveServerTemplatePackage(packageIdOrPath);
  if (!fse.existsSync(path.join(serverTemplateBasePath, "templates"))) {
    console.warn(
      `️🚨 WARNING: \`${packageIdOrPath}\` doesn't provide any templates, so this probably won't generate a working app 😬`
    );
  }
  return serverTemplateBasePath;
}

function resolveServerTemplatePackage(packageId: string): string {
  let packageName = packageId.replace(/(.+)@.*/, "$1"); // lop off the version if present
  try {
    // see if it's already installed 🤞
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (e) {
    // install it (if it's not already cached by npx), and see where npx puts it...
    // the only breadcrumb npx leaves us is the PATH :-/
    let [getPaths, pathsDelimiter] =
      process.platform === "win32" ? ["path", ";"] : ["echo $PATH", ":"];
    let cmd = `npx -y -p "${packageId}" -c "${getPaths.replace("$", "\\$")}"`;
    let paths: Array<string>;
    try {
      paths = execSync(cmd, { stdio: "pipe" }).toString().split(pathsDelimiter);
    } catch (e: any) {
      die(
        `🚨 Oops, \`${packageId}\` doesn't appear to be a valid package id or path.`
      );
    }

    let npxBinDir = paths.find(p => p.includes("_npx"));
    if (!npxBinDir) {
      die(
        `Unable to find npx install location for \`${packageName}\`; this is probably a bug. Current PATH: ${execSync(
          getPaths
        )}`
      );
    }

    return path.dirname(
      require.resolve(`${npxBinDir}/../${packageName}/package.json`)
    );
  }
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

const CUSTOM_SERVER_TEMPLATE = "_custom_" as const;
const ServerTemplateTypes = [
  { name: "Remix App Server", value: "remix" },
  { name: "Express Server", value: "express" },
  { name: "Architect (AWS Lambda)", value: "arc" },
  { name: "Fly.io", value: "fly" },
  { name: "Netlify", value: "netlify" },
  { name: "Vercel", value: "vercel" },
  { name: "Cloudflare Workers", value: "cloudflare-workers" },
  { name: "Custom...", value: CUSTOM_SERVER_TEMPLATE }
] as const;

function isOfficialServerTemplateType(
  server: unknown
): server is OfficialServerTemplateType {
  return !!ServerTemplateTypes.find(({ value }) => value === server);
}

type ServerTemplateType = typeof ServerTemplateTypes[number]["value"];
type OfficialServerTemplateType = Exclude<
  ServerTemplateType,
  typeof CUSTOM_SERVER_TEMPLATE
>;
