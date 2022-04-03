import fse from "fs-extra";

import { checkGitStatus } from "../check-git-status";
import type { Flags } from "./flags";
import { parseMigration } from "./migrations";

const checkProjectDir = (projectDir: string): string => {
  if (!fse.existsSync(projectDir)) {
    throw Error(`Project path does not exist: ${projectDir}`);
  }
  if (!fse.lstatSync(projectDir).isDirectory()) {
    throw Error(`Project path is not a directory: ${projectDir}`);
  }
  return projectDir;
};

export const run = async (input: {
  migrationId: string;
  projectDir: string;
  flags: Flags;
}) => {
  console.log(input);
  let projectDir = checkProjectDir(input.projectDir);
  if (!input.flags.dry) {
    checkGitStatus(projectDir, { force: input.flags.force });
  }

  let migration = parseMigration(input.migrationId);
  return migration.function({ projectDir, flags: input.flags });
};
