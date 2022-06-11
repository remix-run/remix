import meow from "meow";
import semver from "semver";
import * as colors from "@remix-run/dev/colors";

import * as commands from "./commands";

const helpText = `
${colors.logoBlue("R")} ${colors.logoGreen("E")} ${colors.logoYellow(
  "M"
)} ${colors.logoPink("I")} ${colors.logoRed("X")}

${colors.heading("Usage")}:
  $ remix-scripts migrate [-m ${colors.arg("migration")}] [${colors.arg(
  "projectDir"
)}]

${colors.heading("Options")}:
  --help, -h          Print this help message and exit
  --version, -v       Print the CLI version and exit
  --no-color          Disable ANSI colors in console output
\`migrate\` Options:
  --debug             Show debugging logs
  --dry               Dry run (no changes are made to files)
  --force             Bypass Git safety checks and forcibly run migration
  --migration, -m     Name of the migration to run

${colors.heading("Values")}:
  - ${colors.arg(
    "migration"
  )}         One of the choices from https://github.com/remix-run/remix/tree/dev/packages/remix-scripts/cli/migrate/migrations/index.ts
`;

const MINIMUM_NODE_VERSION = 14;

/**
 * Programmatic interface for running the Remix CLI with the given command line
 * arguments.
 */
export async function run(argv: string[] = process.argv.slice(2)) {
  // Check the node version
  let versions = process.versions;
  if (
    versions &&
    versions.node &&
    semver.major(versions.node) < MINIMUM_NODE_VERSION
  ) {
    throw new Error(
      `️🚨 Oops, Node v${versions.node} detected. Remix requires a Node version greater than ${MINIMUM_NODE_VERSION}.`
    );
  }

  let { flags, input, showHelp, showVersion } = meow(helpText, {
    argv,
    booleanDefault: undefined,
    description: false,
    flags: {
      debug: { type: "boolean" },
      dry: { type: "boolean" },
      force: { type: "boolean" },
      migration: { type: "string", alias: "m" },
      help: { type: "boolean", alias: "h" },
      sourcemap: { type: "boolean" },
      version: { type: "boolean", alias: "v" },
    },
  });

  if (flags.help) showHelp();
  if (flags.version) showVersion();

  let command = input[0];

  // Note: Keep each case in this switch statement small.
  switch (command) {
    case "migrate": {
      let { projectDir, migrationId } = await commands.migrate.resolveInput(
        { migrationId: flags.migration, projectId: input[1] },
        flags
      );
      await commands.migrate.run({ flags, migrationId, projectDir });
      break;
    }
    default:
      break;
  }
}
