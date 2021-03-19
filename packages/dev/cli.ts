import type { AnyFlags } from "meow";
import meow from "meow";

import * as commands from "./cli/commands";

const helpText = `
Usage
  $ remix build [remixRoot]
  $ remix run [remixRoot]

Options
  --help              Print this help message and exit
  --version, -v       Print the CLI version and exit

Examples
  $ remix build my-website
  $ remix run my-website
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
    commands.build(cli.input[1], process.env.NODE_ENV);
    break;
  case "build2":
    commands.build2(cli.input[1], process.env.NODE_ENV);
    break;
  case "watch2":
    commands.watch2(cli.input[1], process.env.NODE_ENV);
    break;
  case "run":
    commands.run(cli.input[1]);
    break;
  default:
    // `remix my-project` is shorthand for `remix run my-project`
    commands.run(cli.input[0]);
}
