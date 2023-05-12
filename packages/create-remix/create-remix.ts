import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import stripAnsi from "strip-ansi";
import rm from "rimraf";
import execa from "execa";
import arg from "arg";
import * as semver from "semver";
import sortPackageJSON from "sort-package-json";

import { version as thisRemixVersion } from "./package.json";
import { prompt } from "./prompt";
import {
  color,
  isInteractive,
  ensureDirectory,
  error,
  fileExists,
  info,
  isValidJsonObject,
  log,
  pathContains,
  sleep,
  strip,
  success,
} from "./utils";
import { renderLoadingIndicator } from "./loading-indicator";
import { createTemplate, CreateTemplateError } from "./create-template";
import { getLatestRemixVersion } from "./remix-version";
import { toValidProjectName } from "./project-name";

async function main(argv: string[]) {
  let ctx = await getContext(argv);
  if (ctx.help) {
    printHelp(ctx);
    return;
  }
  if (ctx.versionRequested) {
    log(thisRemixVersion);
    return;
  }

  let steps = [
    introStep,
    projectNameStep,
    templateStep,
    gitInitQuestionStep,
    installDependenciesQuestionStep,
    runInitScriptQuestionStep,
    installDependenciesStep,
    runInitScriptStep,
    gitInitAndCommitStep,
    doneStep,
  ];

  try {
    for (let step of steps) {
      await step(ctx);
    }
  } catch (err) {
    if (ctx.debug) {
      console.error(err);
    }
    throw err;
  }
}

async function getContext(argv: string[]): Promise<Context> {
  let flags = arg(
    {
      "--debug": Boolean,
      "--remix-version": String,
      "-v": "--remix-version",
      "--template": String,
      "--token": String,
      "--yes": Boolean,
      "-y": "--yes",
      "--install": Boolean,
      "--no-install": Boolean,
      "--package-manager": String,
      "--show-install-output": Boolean,
      "--init-script": Boolean,
      "--no-init-script": Boolean,
      "--git-init": Boolean,
      "--no-git-init": Boolean,
      "--help": Boolean,
      "-h": "--help",
      "--version": Boolean,
      "--V": "--version",
      "--no-color": Boolean,
      "--no-motion": Boolean,
    },
    { argv, permissive: true }
  );

  let {
    "--debug": debug = false,
    "--help": help = false,
    "--remix-version": selectedRemixVersion,
    "--template": template,
    "--token": token,
    "--install": install,
    "--no-install": noInstall,
    "--package-manager": pkgManager,
    "--show-install-output": showInstallOutput = false,
    "--git-init": git,
    "--no-init-script": noInitScript,
    "--init-script": initScript,
    "--no-git-init": noGit,
    "--no-motion": noMotion,
    "--yes": yes,
    "--version": versionRequested,
  } = flags;

  let cwd = flags["_"][0] as string;
  let latestRemixVersion = await getLatestRemixVersion();
  let interactive = isInteractive();
  let projectName = cwd;

  if (!interactive) {
    yes = true;
  }

  if (selectedRemixVersion) {
    if (semver.valid(selectedRemixVersion)) {
      // do nothing, we're good
    } else if (semver.coerce(selectedRemixVersion)) {
      selectedRemixVersion = semver.coerce(selectedRemixVersion)!.version;
    } else {
      log(
        `\n${color.warning(
          `${selectedRemixVersion} is an invalid version specifier. Using Remix v${latestRemixVersion}.`
        )}`
      );
      selectedRemixVersion = undefined;
    }
  }

  let context: Context = {
    cwd,
    interactive,
    debug,
    git: git ?? (noGit ? false : yes),
    initScript: initScript ?? (noInitScript ? false : yes),
    initScriptPath: null,
    help,
    install: install ?? (noInstall ? false : yes),
    showInstallOutput,
    noMotion,
    pkgManager: validatePackageManager(
      pkgManager ??
        // npm, pnpm and Yarn set the user agent environment variable that can be used
        // to determine which package manager ran the command.
        (process.env.npm_config_user_agent ?? "npm").split("/")[0]
    ),
    projectName,
    prompt,
    remixVersion: selectedRemixVersion || latestRemixVersion,
    template,
    token,
    versionRequested,
  };

  return context;
}

interface Context {
  cwd: string;
  interactive: boolean;
  debug: boolean;
  git?: boolean;
  initScript?: boolean;
  initScriptPath: null | string;
  help: boolean;
  install?: boolean;
  showInstallOutput: boolean;
  noMotion?: boolean;
  pkgManager: PackageManager;
  projectName?: string;
  prompt: typeof prompt;
  remixVersion: string;
  stdin?: typeof process.stdin;
  stdout?: typeof process.stdout;
  template?: string;
  token?: string;
  versionRequested?: boolean;
}

async function introStep(ctx: Context) {
  log(
    `\n${color.bgWhite(` ${color.whiteBright("remix")} `)}  ${color.green(
      color.bold(`v${ctx.remixVersion}`)
    )} ${color.bold("💿 Let's build a better website...")}`
  );

  if (!ctx.interactive) {
    log("");
    info("Shell is not interactive.", [
      `Using default options. This is equivalent to running with the `,
      color.reset("--yes"),
      ` flag.`,
    ]);
  }
}

async function projectNameStep(ctx: Context) {
  let cwdIsEmpty = ctx.cwd && isEmpty(ctx.cwd);

  // valid cwd is required if shell isn't interactive
  if (!ctx.interactive) {
    if (!ctx.cwd) {
      error("Oh no!", "No project directory provided");
      throw new Error("No project directory provided");
    }

    if (!cwdIsEmpty) {
      error(
        "Oh no!",
        `Project directory "${color.reset(ctx.cwd)}" is not empty`
      );
      throw new Error("Project directory is not empty");
    }
  }

  if (ctx.cwd) {
    await sleep(100);

    if (cwdIsEmpty) {
      info("Directory:", [
        "Using ",
        color.reset(ctx.cwd),
        " as project directory",
      ]);
    } else {
      info("Hmm...", [color.reset(`"${ctx.cwd}"`), " is not empty!"]);
    }
  }

  if (!ctx.cwd || !cwdIsEmpty) {
    let { name } = await ctx.prompt({
      name: "name",
      type: "text",
      label: title("dir"),
      message: "Where should we create your new project?",
      initial: "./my-remix-app",
      validate(value: string) {
        if (!isEmpty(value)) {
          return `Directory is not empty!`;
        }
        return true;
      },
    });
    ctx.cwd = name!;
    ctx.projectName = toValidProjectName(name!);
    return;
  }

  let name = ctx.cwd;
  if (name === "." || name === "./") {
    let parts = process.cwd().split(path.sep);
    name = parts[parts.length - 1];
  } else if (name.startsWith("./") || name.startsWith("../")) {
    let parts = name.split("/");
    name = parts[parts.length - 1];
  }
  ctx.projectName = toValidProjectName(name);
}

async function templateStep(ctx: Context) {
  if (ctx.template) {
    log("");
    info("Template:", [
      "Using ",
      color.reset(ctx.template),
      " as project template",
    ]);
  }

  let template = ctx.template ?? "remix";
  await loadingIndicator({
    start: "Template copying...",
    end: "Template copied",
    while: () => copyTemplate(template, ctx),
    ctx,
  });

  ctx.initScriptPath = await getInitScriptPath(ctx.cwd);
}

async function installDependenciesQuestionStep(ctx: Context) {
  if (ctx.install === undefined) {
    let { deps = true } = await ctx.prompt({
      name: "deps",
      type: "confirm",
      label: title("deps"),
      message: `Install dependencies with ${ctx.pkgManager}?`,
      hint: "recommended",
      initial: true,
    });
    ctx.install = deps;
  }
}

async function runInitScriptQuestionStep(ctx: Context) {
  if (!ctx.initScriptPath) {
    return;
  }

  // We can't run the init script without installing dependencies
  if (!ctx.install) {
    return;
  }

  if (ctx.initScript === undefined) {
    let { init } = await ctx.prompt({
      name: "init",
      type: "confirm",
      label: title("init"),
      message: `This template includes a custom remix.init script. Do you want to run it during the install process?`,
      hint: "recommended",
      initial: true,
    });

    ctx.initScript = init;
  }
}

async function installDependenciesStep(ctx: Context) {
  let { install, pkgManager, showInstallOutput, cwd } = ctx;

  if (!install) {
    await sleep(100);
    info("Skipping install step.", [
      "Remember to install dependencies after setup with ",
      color.reset(`${pkgManager} install`),
      ".",
    ]);
    return;
  }

  function runInstall() {
    return installDependencies({
      cwd,
      pkgManager,
      showInstallOutput,
    });
  }

  if (showInstallOutput) {
    log("");
    info(`Install:`, `Dependencies installing with ${pkgManager}...`);
    log("");
    await runInstall();
    log("");
    return;
  }

  log("");
  await loadingIndicator({
    start: `Dependencies installing with ${pkgManager}...`,
    end: "Dependencies installed",
    while: runInstall,
    ctx,
  });
}

async function runInitScriptStep(ctx: Context) {
  if (!ctx.initScriptPath) {
    return;
  }

  let initCommand = `${packageManagerExecScript[ctx.pkgManager]} remix init`;

  if (!ctx.install || !ctx.initScript) {
    await sleep(100);
    info("Skipping template's custom remix.init script.", [
      ctx.install
        ? "You can run the script in the "
        : "After installing dependencies, you can run the script in the ",
      color.reset("remix.init"),
      " directory with ",
      color.reset(initCommand),
      ".",
    ]);
    return;
  }

  info(
    "Custom remit.init script:",
    "Running template's custom remix.init script...\n"
  );

  let initScriptDir = path.dirname(ctx.initScriptPath);
  let initPackageJson = path.resolve(initScriptDir, "package.json");
  let isTypeScript = fs.existsSync(path.join(ctx.cwd, "tsconfig.json"));
  let packageManager = ctx.pkgManager;

  try {
    if (await fileExists(initPackageJson)) {
      await installDependencies({
        pkgManager: ctx.pkgManager,
        cwd: initScriptDir,
        showInstallOutput: ctx.showInstallOutput,
      });
    }
  } catch (err) {
    error("Oh no!", "Failed to install dependencies for template init script");
    throw err;
  }

  try {
    let initModule = await import(ctx.initScriptPath);
    let initFn: Function;
    if (typeof initModule === "function") {
      initFn = initModule;
    } else if (
      initModule &&
      typeof initModule === "object" &&
      typeof initModule.default === "function"
    ) {
      initFn = initModule.default;
    } else {
      throw new Error("remix.init script doesn't export a function.");
    }
    await initFn({ isTypeScript, packageManager, rootDirectory: ctx.cwd });
  } catch (err) {
    error("Oh no!", "Template's custom remix.init script failed");
    throw err;
  }

  try {
    await rm(initScriptDir);
  } catch (err) {
    error("Oh no!", "Failed to remove template's remix.init script");
    throw err;
  }

  log("");
  success("Template's custom remix.init script complete");
}

async function gitInitQuestionStep(ctx: Context) {
  if (fs.existsSync(path.join(ctx.cwd, ".git"))) {
    info("Nice!", `Git has already been initialized`);
    return;
  }

  let git = ctx.git;
  if (ctx.git === undefined) {
    ({ git } = await ctx.prompt({
      name: "git",
      type: "confirm",
      label: title("git"),
      message: `Initialize a new git repository?`,
      hint: "recommended",
      initial: true,
    }));
  }

  ctx.git = git ?? false;
}

async function gitInitAndCommitStep(ctx: Context) {
  if (!ctx.git) {
    return;
  }

  if (fs.existsSync(path.join(ctx.cwd, ".git"))) {
    log("");
    info("Nice!", `Git has already been initialized`);
    return;
  }

  log("");
  await loadingIndicator({
    start: "Git initializing...",
    end: "Git initialized",
    while: () => gitInitAndCommit({ cwd: ctx.cwd }),
    ctx,
  });
}

async function doneStep(ctx: Context) {
  let projectDir = path.relative(process.cwd(), ctx.cwd);

  let max = process.stdout.columns;
  let prefix = max < 80 ? " " : " ".repeat(9);
  await sleep(200);

  log(`\n ${color.bgWhite(color.black(" done "))}  That's it!`);
  await sleep(100);
  if (projectDir !== "") {
    let enter = [
      `\n${prefix}Enter your project directory using`,
      color.cyan(`cd ./${projectDir}`, ""),
    ];
    let len = enter[0].length + stripAnsi(enter[1]).length;
    log(enter.join(len > max ? "\n" + prefix : " "));
  }
  log(
    `${prefix}Check out ${color.bold(
      "README.md"
    )} for development and deploy instructions.`
  );
  await sleep(100);
  log(
    `\n${prefix}Join the community at ${color.cyan(`https://rmx.as/discord`)}`
  );
  await sleep(200);
}

function isEmpty(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    return true;
  }

  // Some existing files can be safely ignored when checking if
  // a directory is a valid project directory.
  let VALID_PROJECT_DIRECTORY_SAFE_LIST = [".DS_Store", "Thumbs.db"];

  let conflicts = fs.readdirSync(dirPath).filter((content) => {
    return !VALID_PROJECT_DIRECTORY_SAFE_LIST.some((safeContent) => {
      return content === safeContent;
    });
  });
  return conflicts.length === 0;
}

type PackageManager = "npm" | "yarn" | "pnpm";

const packageManagerExecScript: Record<PackageManager, string> = {
  npm: "npx",
  yarn: "yarn",
  pnpm: "pnpm exec",
};

function validatePackageManager(pkgManager: string): PackageManager {
  return packageManagerExecScript.hasOwnProperty(pkgManager)
    ? (pkgManager as PackageManager)
    : "npm";
}

async function installDependencies({
  pkgManager,
  cwd,
  showInstallOutput,
}: {
  pkgManager: PackageManager;
  cwd: string;
  showInstallOutput: boolean;
}) {
  let installExec = execa(pkgManager, ["install"], {
    cwd,
    stdio: showInstallOutput ? "inherit" : "ignore",
  });
  return new Promise<void>((resolve, reject) => {
    installExec.on("error", (err) => {
      error("Oh no!", "Failed to install dependencies.");
      reject(err);
    });
    installExec.on("close", () => resolve());
  });
}

async function gitInitAndCommit({ cwd }: { cwd: string }) {
  let options = { cwd, stdio: "ignore" } as const;
  let commitMsg = "Initial commit from create-remix";
  try {
    await execa("git", ["init"], options);
    await execa("git", ["add", "."], options);
    await execa("git", ["commit", "-m", commitMsg], options);
  } catch (err) {
    error("Oh no!", "Failed to initialize git.");
    throw err;
  }
}

async function copyTemplate(userInput: string, ctx: Context) {
  let destPath = path.resolve(process.cwd(), ctx.cwd);
  await ensureDirectory(destPath);
  await createTemplate(userInput, destPath, {
    debug: ctx.debug,
    token: ctx.token,
    async onError(err) {
      let cwd = process.cwd();
      let removing = (async () => {
        if (cwd !== destPath && !pathContains(cwd, destPath)) {
          try {
            await rm(destPath);
          } catch (_) {
            console.log("failed to remove", destPath);
          }
        }
      })();
      if (ctx.debug) {
        try {
          await removing;
        } catch (_) {}
        throw err;
      }

      await Promise.all([
        error(
          "Oh no!",
          err instanceof CreateTemplateError
            ? err.message
            : "Something went wrong. Run `create-remix --debug` to see more info.\n\n" +
                "Open an issue to report the problem at " +
                "https://github.com/remix-run/remix/issues/new"
        ),
        removing,
      ]);

      throw err;
    },
    async log(message) {
      if (ctx.debug) {
        info("Nice one!", message);
        await sleep(500);
      }
    },
  });
  await updatePackageJSON(ctx);
}

async function updatePackageJSON(ctx: Context) {
  let packageJSONPath = path.join(ctx.cwd, "package.json");
  if (!fs.existsSync(packageJSONPath)) {
    let relativePath = path.relative(process.cwd(), ctx.cwd);
    error(
      "Oh no!",
      "The provided template must be a Remix project with a `package.json` " +
        `file, but that file does not exist in ${color.bold(relativePath)}.`
    );
    throw new Error(`package.json does not exist in ${ctx.cwd}`);
  }

  let contents = await fs.promises.readFile(packageJSONPath, "utf-8");
  let packageJSON: any;
  try {
    packageJSON = JSON.parse(contents);
    if (!isValidJsonObject(packageJSON)) {
      throw Error();
    }
  } catch (err) {
    error(
      "Oh no!",
      "The provided template must be a Remix project with a `package.json` " +
        `file, but that file is invalid.`
    );
    throw err;
  }

  for (let pkgKey of ["dependencies", "devDependencies"] as const) {
    let dependencies = packageJSON[pkgKey];
    if (!dependencies) continue;
    if (!isValidJsonObject(dependencies)) {
      error(
        "Oh no!",
        "The provided template must be a Remix project with a `package.json` " +
          `file, but its ${pkgKey} value is invalid.`
      );
      throw new Error(`package.json ${pkgKey} are invalid`);
    }

    for (let dependency in dependencies) {
      let version = dependencies[dependency];
      if (version === "*") {
        // prettier-ignore
        // @ts-expect-error
        packageJSON[pkgKey][dependency] =
					semver.prerelease(ctx.remixVersion)
					? // Templates created from prereleases should pin to a specific version
					  ctx.remixVersion
					: "^" + ctx.remixVersion;
      }
    }
  }

  if (!ctx.initScriptPath) {
    packageJSON.name = ctx.projectName;
  }

  fs.promises.writeFile(
    packageJSONPath,
    JSON.stringify(sortPackageJSON(packageJSON), null, 2),
    "utf-8"
  );
}

async function loadingIndicator(args: {
  start: string;
  end: string;
  while: (...args: any) => Promise<any>;
  ctx: Context;
}) {
  let { ctx, ...rest } = args;
  await renderLoadingIndicator({
    ...rest,
    noMotion: args.ctx.noMotion,
  });
}

function title(text: string) {
  return align(color.bgWhite(` ${color.whiteBright(text)} `), "end", 7) + " ";
}

function printHelp(ctx: Context) {
  // prettier-ignore
  let output = `
${title("create-remix")}

${color.heading("Usage")}:

${color.dim("$")} ${color.greenBright("create-remix")} ${color.arg("<projectDir>")} ${color.arg("<...options>")}

${color.heading("Values")}:

${color.arg("projectDir")}          ${color.dim(`The Remix project directory`)}

${color.heading("Options")}:

${color.arg("--help, -h")}          ${color.dim(`Print this help message and exit`)}
${color.arg("--version, -V")}       ${color.dim(`Print the CLI version and exit`)}
${color.arg("--no-color")}          ${color.dim(`Disable ANSI colors in console output`)}
${color.arg("--no-motion")}         ${color.dim(`Disable animations in console output`)}

${color.arg("--template <name>")}   ${color.dim(`The project template to use`)}
${color.arg("--[no-]install")}      ${color.dim(`Whether or not to install dependencies after creation`)}
${color.arg("--package-manager")}   ${color.dim(`The package manager to use`)}
${color.arg("--show-install-output")}   ${color.dim(`Whether to show the output of the install process`)}
${color.arg("--[no-]init-script")}  ${color.dim(`Whether or not to run the template's custom remix.init script, if present`)}
${color.arg("--[no-]git-init")}     ${color.dim(`Whether or not to initialize a Git repository`)}
${color.arg("--yes, -y")}           ${color.dim(`Skip all option prompts and run setup`)}
${color.arg("--remix-version, -v")}     ${color.dim(`The version of Remix to use`)}

${color.heading("Creating a new project")}:

Remix projects are created from templates. A template can be:

  - a file path to a directory of files
  - a file path to a tarball
  - the name of a :username/:repo on GitHub
  - the URL of a GitHub repository (or directory within it)
  - the URL of a tarball
${[
	"/path/to/remix-template",
	"/path/to/remix-template.tar.gz",
	"remix-run/grunge-stack",
	":username/:repo",
	"https://github.com/:username/:repo",
	"https://github.com/:username/:repo/tree/:branch",
	"https://github.com/:username/:repo/tree/:branch/:directory",
	"https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz",
	"https://example.com/remix-template.tar.gz",
].reduce((str, example) => {
	return `${str}\n${color.dim("$")} ${color.greenBright("create-remix")} my-app ${color.arg(`--template ${example}`)}`;
}, "")}

To create a new project from a template in a private GitHub repo,
pass the \`token\` flag with a personal access token with access
to that repo.

${color.heading("Initialize a project")}:

Remix project templates may contain a \`remix.init\` directory
with a script that initializes the project. This script automatically
runs during \`remix create\`, but if you ever need to run it manually
you can run:

${color.dim("$")} ${color.greenBright("remix")} init
`;

  log(output);
}

function align(text: string, dir: "start" | "end" | "center", len: number) {
  let pad = Math.max(len - strip(text).length, 0);
  switch (dir) {
    case "start":
      return text + " ".repeat(pad);
    case "end":
      return " ".repeat(pad) + text;
    case "center":
      return (
        " ".repeat(Math.floor(pad / 2)) + text + " ".repeat(Math.floor(pad / 2))
      );
    default:
      return text;
  }
}

async function getInitScriptPath(cwd: string) {
  let initScriptDir = path.join(cwd, "remix.init");
  let initScriptPath = path.resolve(initScriptDir, "index.js");
  return (await fileExists(initScriptPath)) ? initScriptPath : null;
}

export { main };
export type { Context };
