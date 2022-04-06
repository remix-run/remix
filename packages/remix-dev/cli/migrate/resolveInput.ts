import inquirer from "inquirer";

import { migrations } from "./migrations";

export const resolveProjectDir = (input?: string): string => {
  return input || process.env.REMIX_ROOT || process.cwd();
};

export const resolveMigrationId = async (input?: string): Promise<string> => {
  if (input !== undefined) return input;
  let { migrationId } = await inquirer.prompt<{ migrationId?: string }>([
    {
      name: "migrationId",
      message: "Which migration would you like to apply?",
      type: "list",
      when: !input,
      pageSize: migrations.length + 1,
      choices: [
        ...migrations.map(({ id, description }) => ({
          name: `${id}: ${description}`,
          value: id,
        })),
        {
          name: "Nevermind...",
          value: undefined,
        },
      ],
    },
  ]);
  if (migrationId === undefined) {
    // user selected "Nevermind..."
    process.exit(0);
  }
  return migrationId;
};
