import fse from "fs-extra";

import type { Migration } from "./migration-options";
import { migrationOptions } from "./migration-options";
import { isMigration } from "./migration-options";
import * as colors from "../colors";

export const checkProjectDir = (projectDir: string): string => {
  if (!fse.existsSync(projectDir)) {
    throw Error(`Project path does not exist: ${projectDir}`);
  }
  if (!fse.lstatSync(projectDir).isDirectory()) {
    throw Error(`Project path is not a directory: ${projectDir}`);
  }
  return projectDir;
};

export const checkMigration = (migration: string): Migration => {
  if (!isMigration(migration)) {
    throw Error(`
${colors.error("Invalid migration. Pick one of:")}
${migrationOptions.map((m) => colors.error(`- ${m.value}`)).join("\n")}
    `);
  }
  return migration;
};
