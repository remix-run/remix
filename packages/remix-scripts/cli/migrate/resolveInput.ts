import inquirer from "inquirer";
import * as colors from "@remix-run/dev/colors";
import { execFileSync } from "child_process";

import type { Flags } from "./flags";
import { migrations } from "./migrations";

const TEN_MEBIBYTE = 1024 * 1024 * 10;

function resolveProjectDir(input?: string): string {
  return input || process.env.REMIX_ROOT || process.cwd();
}

async function resolveMigrationId(input?: string): Promise<string> {
  if (input !== undefined) return input;
  let { migrationId } = await inquirer.prompt<{ migrationId?: string }>([
    {
      name: "migrationId",
      message: "Which migration would you like to apply?",
      type: "list",
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
}

export async function resolveInput(
  input: {
    projectId: string;
    migrationId?: string;
  },
  flags: Flags
) {
  let projectDir = resolveProjectDir(input.projectId);
  if (!flags.dry) {
    checkGitStatus(projectDir, { force: flags.force });
  }
  let migrationId = await resolveMigrationId(input.migrationId);
  return {
    projectDir,
    migrationId,
  };
}

function checkGitStatus(projectDir: string, { force = false }) {
  let clean = false;
  let errorMessage = "Unable to determine if git directory is clean";

  try {
    clean = isGitClean(projectDir);
    errorMessage = "Git directory is not clean";
  } catch (err: any) {
    if (err?.stderr.indexOf("Not a git repository") >= 0) {
      clean = true;
    }
  }

  if (clean) {
    return;
  }

  if (force) {
    console.log(
      colors.warning(`WARNING: ${errorMessage}. Forcibly continuing.`)
    );
  } else {
    console.log(
      colors.warning(
        "\nBefore we continue, please stash or commit your git changes."
      )
    );
    console.log(
      "\nYou may use the --force flag to override this safety check."
    );

    process.exit(1);
  }
}

function isGitClean(dir: string = process.cwd()) {
  return !execFileSync("git", ["status", "--porcelain"], {
    cwd: dir,
    encoding: "utf8",
    maxBuffer: TEN_MEBIBYTE,
  })?.trim();
}
