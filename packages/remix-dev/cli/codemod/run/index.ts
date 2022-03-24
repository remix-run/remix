import { join } from "path";
import { sync as execaSync } from "execa";

import type { Answers } from "../questions";
import { validateAnswers } from "./validate-answers";

const jscodeshiftExecutable = require.resolve(".bin/jscodeshift");
const transformsDirectory = join(__dirname, "transforms");

type RunArgs = {
  answers: Answers;
  flags: { dry?: boolean; print?: boolean; runInBand?: boolean };
};
export const run = async ({
  answers,
  flags: { dry, print, runInBand },
}: RunArgs) => {
  let { files, transform } = validateAnswers(answers);

  let transformPath = join(transformsDirectory, transform);
  let args = [
    dry ? "--dry" : "",
    print ? "--print" : "",
    runInBand ? "--run-in-band" : "",
    "--verbose=2",
    "--ignore-pattern=**/node_modules/**",
    "--ignore-pattern=**/.cache/**",
    "--ignore-pattern=**/build/**",
    "--extensions=tsx,ts,jsx,js",
    "--parser=tsx",
    ...["--transform", transformPath],
    ...files,
  ];

  console.log(`Executing command: jscodeshift ${args.join(" ")}`);

  let result = execaSync(jscodeshiftExecutable, args, {
    stdio: "inherit",
    stripFinalNewline: false,
  });

  if (result.failed) {
    throw new Error(`jscodeshift exited with code ${result.exitCode}`);
  }
};
