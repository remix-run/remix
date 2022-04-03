import { checkGitStatus } from "../check-git-status";
import type { migrationOptions } from "./migration-options";
import type { Transform, TransformArgs } from "./transforms";
import { updateRemixImports } from "./transforms";
import { checkProjectDir, checkMigration } from "./check";

const transformFunctionByName: Record<
  typeof migrationOptions[number]["value"],
  Transform
> = {
  "replace-remix-imports": updateRemixImports,
};

export const run = async (input: {
  migration: string;
  projectDir: string;
  flags: TransformArgs["flags"];
}) => {
  let projectDir = checkProjectDir(input.projectDir);
  let migration = checkMigration(input.migration);

  if (!input.flags.dry) {
    checkGitStatus(projectDir, { force: input.flags.force });
  }

  let transformFunction = transformFunctionByName[migration];
  return transformFunction({ projectDir, flags: input.flags });
};
