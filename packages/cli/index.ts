import type { AnyFlags } from "meow";
import meow from "meow";
import { commands } from "@remix-run/core";

const helpText = `
Usage
  $ remix run [remixRoot]
  $ remix build [remixRoot]

Options
  --help              Print this help message and exit
  --version, -v       Print the CLI version and exit

Examples
  $ remix run my-website
  $ remix build my-website
`;

const flags: AnyFlags = {
  version: {
    type: "boolean",
    alias: "v"
  }
};

const cli = meow(helpText, {
  autoHelp: true,
  autoVersion: false,
  description: false,
  flags
});

if (cli.flags.version) {
  cli.showVersion();
}

switch (cli.input[0]) {
  case "build":
    commands.build(cli.input[1]);
    break;
  case "run":
    commands.run(cli.input[1]);
    break;
  default:
    // `remix my-project` is shorthand for `remix run my-project`
    commands.run(cli.input[0]);
}
