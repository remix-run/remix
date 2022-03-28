import * as path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import inspector from "inspector";
import fse from "fs-extra";
import meow from "meow";
import inquirer from "inquirer";
import ora from "ora";
import fetch from "node-fetch";

import * as colors from "./colors";
import * as commands from "./commands";
import type { TemplateType } from "./create";

const helpText = `
${colors.logoBlue("R")} ${colors.logoGreen("E")} ${colors.logoYellow(
  "M"
)} ${colors.logoPink("I")} ${colors.logoRed("X")}

${colors.heading("Usage")}:
  $ remix create <${colors.arg("projectDir")}> --template <${colors.arg(
  "template"
)}>
  $ remix init [${colors.arg("projectDir")}]
  $ remix build [${colors.arg("projectDir")}]
  $ remix dev [${colors.arg("projectDir")}]
  $ remix routes [${colors.arg("projectDir")}]
  $ remix setup [${colors.arg("remixPlatform")}]

${colors.heading("Options")}:
  --help, -h          Print this help message and exit
  --version, -v       Print the CLI version and exit
  --no-color          Disable ANSI colors in console output
\`create\` Options:
  --template          The template to use
  --no-install        Skip installing dependencies after creation
  --no-typescript     Convert the template to JavaScript
  --remix-version     The version of Remix to use
\`build\` Options:
  --sourcemap         Generate source maps for production
\`dev\` Options:
  --debug             Attach Node.js inspector
\`routes\` Options:
  --json              Print the routes as JSON

${colors.heading("Values")}:
  - ${colors.arg("projectDir")}        The Remix project directory
  - ${colors.arg("template")}          The project template to use
  - ${colors.arg("remixPlatform")}     node or cloudflare

${colors.heading("Creating a new project")}:

  Remix projects are created from templates. A template can be:

  - a file path to a directory of files
  - a file path to a tarball
  - the name of a :username/:repo on GitHub
  - the URL of a tarball

  $ remix create my-app --template /path/to/remix-template
  $ remix create my-app --template /path/to/remix-template.tar.gz
  $ remix create my-app --template remix-run/grunge-stack
  $ remix create my-app --template :username/:repo
  $ remix create my-app --template https://github.com/:username/:repo
  $ remix create my-app --template https://github.com/:username/:repo/tree/:branch
  $ remix create my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
  $ remix create my-app --template https://example.com/remix-template.tar.gz

  To create a new project from a template in a private GitHub repo,
  set the \`GITHUB_TOKEN\` environment variable to a personal access
  token with access to that repo.

${colors.heading("Initialize a project:")}:

  Remix project templates may contain a \`remix.init\` directory
  with a script that initializes the project. This script automatically
  runs during \`remix create\`, but if you ever need to run it manually
  (e.g. to test it out) you can:

  $ remix init

${colors.heading("Build your project")}:

  $ remix build
  $ remix build --sourcemap
  $ remix build my-app

${colors.heading("Run your project locally in development")}:

  $ remix dev
  $ remix dev my-app
  $ remix dev --debug

${colors.heading("Show all routes in your app")}:

  $ remix routes
  $ remix routes my-app
  $ remix routes --json
`;

const stackChoices = [
  {
    name: "Blues",
    value: "remix-run/blues-stack",
  },
  {
    name: "Indie",
    value: "remix-run/indie-stack",
  },
  {
    name: "Grunge",
    value: "remix-run/grunge-stack",
  },
];

const templateChoices = [
  { name: "Remix App Server", value: "remix" },
  { name: "Express Server", value: "express" },
  { name: "Architect (AWS Lambda)", value: "arc" },
  { name: "Fly.io", value: "fly" },
  { name: "Netlify", value: "netlify" },
  { name: "Vercel", value: "vercel" },
  { name: "Cloudflare Pages", value: "cloudflare-pages" },
  { name: "Cloudflare Workers", value: "cloudflare-workers" },
];

/**
 * Programmatic interface for running the Remix CLI with the given command line
 * arguments.
 */
export async function run(argv: string[] = process.argv.slice(2)) {
  let { flags, input, showHelp, showVersion } = meow(helpText, {
    argv: argv,
    description: false,
    booleanDefault: undefined,
    flags: {
      debug: { type: "boolean" },
      help: { type: "boolean", alias: "h" },
      install: { type: "boolean" },
      json: { type: "boolean" },
      remixVersion: { type: "string" },
      sourcemap: { type: "boolean" },
      template: { type: "string" },
      typescript: { type: "boolean" },
      version: { type: "boolean", alias: "v" },
    },
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();
  if (flags.template === "typescript" || flags.template === "ts") {
    flags.template = "remix-ts";
  }

  let command = input[0];

  // Note: Keep each case in this switch statement small.
  switch (command) {
    case "create":
    // `remix new` is an alias for `remix create`
    case "new": {
      let projectPath = input[1];
      let templateType: string;

      // Flags will validate early and stop the process if invalid flags are
      // provided. Input provided in the interactive CLI is validated by inquirer
      // step-by-step. This not only allows us to catch issues as early as possible,
      // but inquirer will allow users to retry input rather than stop the process.
      if (flags.template) {
        templateType = await validateTemplate(flags.template);
      }
      if (projectPath) {
        await validateNewProjectPath(projectPath);
      }

      let projectDir = projectPath
        ? path.resolve(process.cwd(), projectPath)
        : await inquirer
            .prompt<{ dir: string }>([
              {
                type: "input",
                name: "dir",
                message: "Where would you like to create your app?",
                default: "./my-remix-app",
                async validate(input) {
                  try {
                    await validateNewProjectPath(String(input));
                    return true;
                  } catch (error) {
                    if (error instanceof Error && error.message) {
                      return error.message;
                    }
                    throw error;
                  }
                },
              },
            ])
            .then(async (input) => {
              return path.resolve(process.cwd(), input.dir);
            })
            .catch((error) => {
              if (error.isTtyError) {
                showHelp();
                return;
              }
              throw error;
            });

      if (!projectDir) {
        showHelp();
        return;
      }

      let answers = await inquirer
        .prompt<{
          appType: "template" | "stack";
          appTemplate: string;
          useTypeScript: boolean;
          install: boolean;
        }>([
          {
            name: "appType",
            type: "list",
            message: "What type of app do you want to create?",
            when() {
              return flags.template === undefined;
            },
            choices: [
              {
                name: "A pre-configured stack ready for production",
                value: "stack",
              },
              {
                name: "Just the basics",
                value: "template",
              },
            ],
          },
          {
            name: "appTemplate",
            type: "list",
            when(answers) {
              return answers.appType === "stack";
            },
            message: "Which Stack do you want? ",
            loop: false,
            suffix: "(Learn more about these stacks: https://remix.run/stacks)",
            choices: stackChoices,
          },
          {
            name: "appTemplate",
            type: "list",
            when(answers) {
              return answers.appType === "template";
            },
            message: `Where do you want to deploy? Choose Remix if you're unsure; it's easy to change deployment targets.`,
            loop: false,
            choices: templateChoices,
          },
          {
            name: "useTypeScript",
            type: "list",
            message: "TypeScript or JavaScript?",
            when(answers) {
              return (
                flags.template === undefined && answers.appType !== "stack"
              );
            },
            choices: [
              { name: "TypeScript", value: true },
              { name: "JavaScript", value: false },
            ],
          },
          {
            name: "install",
            type: "confirm",
            message: "Do you want me to run `npm install`?",
            when() {
              return flags.install === undefined;
            },
            default: true,
          },
        ])
        .catch((error) => {
          if (error.isTtyError) {
            console.warn(
              colors.warning(
                "🚨 Your terminal doesn't support interactivity; using default configuration.\n\n" +
                  "If you'd like to use different settings, try passing them as arguments. Run " +
                  "`npx create-remix@latest --help` to see available options."
              )
            );
            return {
              appType: "template",
              appTemplate: "remix",
              useTypeScript: true,
              install: true,
            };
          }
          throw error;
        });

      await commands.create({
        appTemplate: flags.template ?? answers.appTemplate,
        templateType:
          templateType! || answers.appType === "stack" ? "repo" : "template",
        projectDir,
        remixVersion: flags.remixVersion,
        installDeps: flags.install ?? answers.install,
        useTypeScript: flags.typescript ?? answers.useTypeScript,
        githubToken: process.env.GITHUB_TOKEN,
      });
      break;
    }
    case "init":
      await commands.init(input[1] || process.env.REMIX_ROOT || process.cwd());
      break;
    case "routes":
      await commands.routes(input[1], flags.json ? "json" : "jsx");
      break;
    case "build":
      if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";
      await commands.build(input[1], process.env.NODE_ENV, flags.sourcemap);
      break;
    case "watch":
      if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
      await commands.watch(input[1], process.env.NODE_ENV);
      break;
    case "setup":
      await commands.setup(input[1]);
      break;
    case "dev":
      if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
      if (flags.debug) inspector.open();
      await commands.dev(input[1], process.env.NODE_ENV);
      break;
    default:
      // `remix ./my-project` is shorthand for `remix dev ./my-project`
      if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
      await commands.dev(input[0], process.env.NODE_ENV);
  }
}

async function validateNewProjectPath(input: string): Promise<void> {
  let cwd = process.cwd();
  let projectDir = path.resolve(cwd, input);
  if (cwd === projectDir) {
    let contents = await fse.readdir(projectDir);
    if (contents.length > 0) {
      throw Error(
        `🚨 The current directory must be empty to create a new project. Please clear the contents of the directory or choose a different path.`
      );
    }
    return;
  }

  if (
    (await fse.pathExists(projectDir)) &&
    (await fse.stat(projectDir)).isDirectory()
  ) {
    throw Error(
      `🚨 The directory provided already exists. Please try again with a different directory.`
    );
  }
}

async function validateTemplate(input: string): Promise<TemplateType> {
  // If a template string matches one of the choices in our interactive
  // prompt, we can skip fetching and manual validation
  if (stackChoices.find((choice) => choice.value === input)) {
    return "repo";
  }
  if (templateChoices.find((choice) => choice.value === input)) {
    return "template";
  }

  let templateType = detectTemplateType(input);
  switch (templateType) {
    case "validatedLocal":
      return "local";
    case "local": {
      if (input.startsWith("file://")) {
        input = fileURLToPath(input);
      }
      if (!(await fse.pathExists(input))) {
        throw Error(`🚨 Oops, the file \`${input}\` does not exist.`);
      }
      return "local";
    }
    case "remoteTarball": {
      let spinner = ora("Validating the template file…").start();
      try {
        let response = await fetch(input, { method: "HEAD" });
        spinner.stop();
        switch (response.status) {
          case 200:
            return "remoteTarball";
          case 404:
            throw Error(
              `🚨 The template file could not be verified. Please double check the URL and try again.`
            );
          default:
            throw Error(
              `🚨 The template file could not be verified. The server returned a response with a ${response.status} status. Please double check the URL and try again.`
            );
        }
      } catch (err) {
        spinner.stop();
        throw Error(
          `🚨 There was a problem verifying the template file. Please ensure you are connected to the internet and try again later.`
        );
      }
    }
    case "repo": {
      let spinner = ora("Validating the template repo…").start();
      let { url, filePath } = getRepoInfo(input);
      try {
        let response = await fetch(url, { method: "HEAD" });
        spinner.stop();
        switch (response.status) {
          case 200:
            return "repo";
          case 403:
            throw Error(
              `🚨 The template could not be verified because you do not have access to the repository. Please double check the access rights of this repo and try again.`
            );
          case 404:
            throw Error(
              `🚨 The template could not be verified. Please double check that the template is a valid GitHub repository${
                filePath && filePath !== "/"
                  ? " and that the filepath points to a directory in the repo"
                  : ""
              } and try again.`
            );
          default:
            throw Error(
              `🚨 The template could not be verified. The server returned a response with a ${response.status} status. Please double check that the template is a valid GitHub repository  and try again.`
            );
        }
      } catch (_) {
        spinner.stop();
        throw Error(
          `🚨 There was a problem verifying the template. Please ensure you are connected to the internet and try again later.`
        );
      }
    }
    case "example":
    case "template": {
      let spinner = ora("Validating the template…").start();
      let name = input;
      if (templateType === "example") {
        name = name.split("/")[1];
      }
      let typeDir = templateType + "s";
      let templateUrl = `https://github.com/remix-run/remix/tree/main/${typeDir}/${name}`;
      try {
        let response = await fetch(templateUrl, { method: "HEAD" });
        spinner.stop();
        switch (response.status) {
          case 200:
            return templateType;
          case 404:
            throw Error(
              `🚨 The template could not be verified. Please double check that the template is a valid project directory in https://github.com/remix-run/remix/tree/main/${typeDir} and try again.`
            );
          default:
            throw Error(
              `🚨 The template could not be verified. The server returned a response with a ${response.status} status. Please double check that the template is a valid project directory in https://github.com/remix-run/remix/tree/main/${typeDir} and try again.`
            );
        }
      } catch (_) {
        spinner.stop();
        throw Error(
          `🚨 There was a problem verifying the template. Please ensure you are connected to the internet and try again later.`
        );
      }
    }
  }

  throw Error("🚨 Invalid template selected. Please try again.");
}

function detectTemplateType(
  template: string
): TemplateType | "validatedLocal" | null {
  // 1. Check if the user passed a local file. If they hand us an explicit file
  //    URL, we'll validate it first. Otherwise we just ping the filesystem to
  //    see if the string references a filepath and, if not, move on.
  if (template.startsWith("file://")) {
    return "local";
  }

  try {
    if (
      fs.existsSync(
        path.isAbsolute(template)
          ? template
          : path.resolve(process.cwd(), template)
      )
    ) {
      // We know this exists, so no need to validate again
      return "validatedLocal";
    }
  } catch (_) {
    // ignore FS errors and move on
  }

  // 3. examples/<template> will use an example folder in the Remix repo
  if (/^examples?\/[\w-]+$/.test(template)) {
    return "example";
  }

  // 2. If the string contains no slashes, spaces, or special chars, we assume
  //    it is one of our templates.
  if (/^[\w-]+$/.test(template)) {
    return "template";
  }

  // 3. Handle GitHub repos (URLs or :org/:repo shorthand)
  if (isValidGithubUrl(template) || isGithubRepoShorthand(template)) {
    return "repo";
  }

  // 4. Any other valid URL should be treated as a tarball.
  if (isUrl(template)) {
    return "remoteTarball";
  }

  return null;
}

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch (_) {
    return false;
  }
}

type GithubUrlString =
  | `https://github.com/${string}/${string}`
  | `https://www.github.com/${string}/${string}`;

function isValidGithubUrl(value: string | URL): value is URL | GithubUrlString {
  try {
    let url = typeof value === "string" ? new URL(value) : value;
    let pathSegments = url.pathname.slice(1).split("/");

    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      // The pathname must have at least 2 segments. If it has more than 2, the
      // third must be "tree" and it must have at least 4 segments.
      // https://github.com/remix-run/remix
      // https://github.com/remix-run/remix/tree/dev
      pathSegments.length >= 2 &&
      (pathSegments.length > 2
        ? pathSegments[2] === "tree" && pathSegments.length >= 4
        : true)
    );
  } catch (_) {
    return false;
  }
}

function isGithubRepoShorthand(value: string) {
  return /^[\w-]+\/[\w-]+$/.test(value);
}

function getGithubUrl(info: Omit<RepoInfo, "url">) {
  let url = `https://github.com/${info.owner}/${info.name}`;
  if (info.branch) {
    url += `/${info.branch}`;
    if (info.filePath && info.filePath !== "/") {
      url += `/${info.filePath}`;
    }
  }
  return url;
}

function getRepoInfo(validatedGithubUrl: string): RepoInfo {
  if (isGithubRepoShorthand(validatedGithubUrl)) {
    let [owner, name] = validatedGithubUrl.split("/");
    return {
      url: getGithubUrl({ owner, name, branch: null, filePath: null }),
      owner,
      name,
      branch: null,
      filePath: null,
    };
  }

  let url = new URL(validatedGithubUrl);
  let [, owner, name, tree, branch, ...file] = url.pathname.split("/") as [
    _: string,
    Owner: string,
    Name: string,
    Tree: string | undefined,
    Branch: string | undefined,
    FileInfo: string | undefined
  ];
  let filePath = file.join(path.sep);

  if (tree === undefined) {
    return {
      url: validatedGithubUrl,
      owner,
      name,
      branch: null,
      filePath: null,
    };
  }

  return {
    url: validatedGithubUrl,
    owner,
    name,
    // If we've validated the GitHub URL and there is a tree, there will also be a branch
    branch: branch!,
    filePath: filePath === "" || filePath === "/" ? null : filePath,
  };
}

type RepoInfo = RepoInfoWithBranch | RepoInfoWithoutBranch;

interface RepoInfoWithBranch {
  url: string;
  owner: string;
  name: string;
  branch: string;
  filePath: string | null;
}

interface RepoInfoWithoutBranch {
  url: string;
  owner: string;
  name: string;
  branch: null;
  filePath: null;
}
