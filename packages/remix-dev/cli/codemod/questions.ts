import inquirer from "inquirer";

import { transformOptions } from "./transform-options";

export type Answers = {
  files: string;
  transform: string;
};

type QuestionsArgs = {
  input: { files: string; transform: string };
  showHelp: () => void;
};
export const questions = async ({
  input,
  showHelp,
}: QuestionsArgs): Promise<Answers> => {
  let { files, transform } = await inquirer
    .prompt<Answers>([
      {
        type: "input",
        name: "files",
        message: "On which files or directory should the codemod be applied?",
        when: !input.files,
        default: ".",
        filter: (files) => files.trim(),
      },
      {
        type: "list",
        name: "transform",
        message: "Which transform would you like to apply?",
        when: !input.transform,
        pageSize: transformOptions.length,
        choices: transformOptions,
      },
    ])
    .catch((error) => {
      if (error.isTtyError) {
        showHelp();

        return {
          files: ".",
          transform: "",
        };
      }

      throw error;
    });

  return {
    files: input.files || files,
    transform: input.transform || transform,
  };
};
