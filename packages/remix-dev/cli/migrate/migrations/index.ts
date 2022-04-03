import type { Migration } from "../types";
import { updateRemixImports } from "./replace-remix-imports";
import * as colors from "../../colors";

export const migrations: readonly Migration[] = [
  {
    id: "replace-remix-imports",
    description:
      "Replaces `remix` package import statements with specific `@remix-run/*` package import statements.",
    function: updateRemixImports,
  },
] as const;

export const parseMigration = (migrationId: string): Migration => {
  let migration = migrations.find((m) => m.id === migrationId);
  if (migration === undefined) {
    throw Error(`
${colors.error("Invalid migration. Pick one of:")}
${migrations.map((m) => colors.error(`- ${m.id}`)).join("\n")}
    `);
  }
  return migration;
};
