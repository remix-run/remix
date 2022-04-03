import inquirer from "inquirer";

import { migrations } from "./migrations";

export const resolveProjectDir = (input?: string): string => {
  return input || process.env.REMIX_ROOT || process.cwd();
};

export const resolveMigrationId = async (input?: string): Promise<string> => {
  let { migrationId } = await inquirer.prompt<{ migrationId: string }>([
    {
      name: "migrationId",
      message: "Which migration would you like to apply?",
      type: "list",
      when: !input,
      pageSize: migrations.length,
      choices: migrations.map((m) => ({
        name: `${m.id}: ${m.description}`,
        value: m.id,
      })),
    },
  ]);
  // TODO need to catch inquirer prompt?
  console.log({ input, migrationId });
  return input || migrationId;
};
