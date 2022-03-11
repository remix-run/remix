import meow from "meow";
import inspector from "inspector";

import * as colors from "./colors";
import * as commands from "./cli/commands";
import packageJson from "./package.json";

const remixDevPackageVersion = packageJson.version;

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
  --template          The template to use (required)
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
  - ${colors.arg(
    "remixPlatform"
  )}     node, cloudflare-pages, cloudflare-workers, or deno

${colors.heading("Creating a new project")}:

  Remix projects are created from templates. A template can be:

  - a file path to a directory of files
  - a file path to a tarball
  - the name of a repo in the remix-run GitHub org
  - the name of a username/repo on GitHub
  - the URL of a tarball

  $ remix create my-app --template /path/to/remix-template
  $ remix create my-app --template /path/to/remix-template.tar.gz
  $ remix create my-app --template [remix-run/]grunge-stack
  $ remix create my-app --template github-username/repo-name
  $ remix create my-app --template https://github.com/:username/:repo
  $ remix create my-app --template https://github.com/:username/:repo/tree/:branch
  $ remix create my-app --template https://github.com/:username/:repo/archive/refs/tags/:tag.tar.gz
  $ remix create my-app --template https://example.com/remix-template.tar.gz

  To create a new project from a template in a private GitHub repo,
  set the \`GITHUB_PAT\` environment variable to a personal access
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

async function run() {
  let { flags, input, showHelp, showVersion } = meow(helpText, {
    description: false,
    flags: {
      help: { type: "boolean", alias: "h" },
      version: { type: "boolean", alias: "v" },
      template: { type: "string" },
      install: { type: "boolean", default: true },
      typescript: { type: "boolean", default: true },
      remixVersion: { type: "string", default: remixDevPackageVersion },
      json: { type: "boolean" },
      sourcemap: { type: "boolean" },
      debug: { type: "boolean" },
    },
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();

  switch (input[0]) {
    case "create":
    // `remix new` is an alias for `remix create`
    case "new": {
      let projectDir = input[1];
      if (!projectDir) showHelp();
      if (!flags.template) {
        console.error(colors.error("Missing --template value"));
        process.exit(1);
      }

      await commands.create({
        appTemplate: flags.template,
        projectDir,
        remixVersion: flags.remixVersion,
        installDeps: flags.install,
        useTypeScript: flags.typescript,
        githubPAT: process.env.GITHUB_PAT,
      });
      break;
    }
    case "init": {
      let remixRoot = input[1];
      if (!remixRoot) remixRoot = process.env.REMIX_ROOT || process.cwd();
      await commands.init(remixRoot);
      break;
    }
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

run().then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
