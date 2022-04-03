import inquirer from "inquirer";

import type { Migration } from "./migration-options";
import { migrationOptions } from "./migration-options";

export const resolveProjectDir = (input?: string): string => {
  return input || process.env.REMIX_ROOT || process.cwd();
};

export const resolveMigration = async (input?: string): Promise<string> => {
  let { migration } = await inquirer.prompt<{ migration: Migration }>([
    {
      name: "migration",
      message: "Which migration would you like to apply?",
      type: "list",
      when: !input,
      pageSize: migrationOptions.length,
      choices: migrationOptions,
    },
  ]);
  // TODO need to catch inquirer prompt?
  return input || migration;
};
