import { checkGitStatus } from "../../check-git-status";
import type { migrationOptions } from "../migration-options";
import type { Transform, TransformArgs } from "./transforms";
import { updateRemixImports } from "./transforms";
import { validateAnswers } from "./validate-answers";

const transformFunctionByName: Record<
  typeof migrationOptions[number]["value"],
  Transform
> = {
  "replace-remix-imports": updateRemixImports,
};

type RunArgs = Pick<TransformArgs, "answers" | "flags">;
export const run = async ({ answers, flags }: RunArgs) => {
  let { files, migration } = validateAnswers(answers);

  if (!flags.dry) {
    checkGitStatus(answers.projectDir, { force: flags.force });
  }

  let transformFunction = transformFunctionByName[migration];
  return transformFunction({ answers, files, flags });
};
