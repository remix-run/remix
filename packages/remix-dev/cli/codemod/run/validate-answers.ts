import { sync as globbySync } from "globby";

import * as colors from "../../colors";
import type { Answers } from "../questions";
import { transformOptions } from "../transform-options";

const expandFilePathsIfNeeded = (filesBeforeExpansion: string) => {
  let shouldExpandFiles = filesBeforeExpansion.includes("*");

  return shouldExpandFiles
    ? globbySync(filesBeforeExpansion)
    : [filesBeforeExpansion];
};

export const validateAnswers = ({ files, transform }: Answers) => ({
  files: validateFiles(files),
  transform: validateTransform(transform),
});

const validateFiles = (files: Answers["files"]) => {
  let expandedFiles = expandFilePathsIfNeeded(files);

  if (expandedFiles.length === 0) {
    throw Error(`No files found matching ${files}`);
  }

  return expandedFiles;
};

const validateTransform = (
  transform: Answers["transform"]
): typeof transformOptions[number]["value"] => {
  if (!transformOptions.find(({ value }) => value === transform)) {
    throw Error(`
${colors.error("Invalid transform choice, pick one of:")} 
${transformOptions.map(({ value }) => colors.error(`- ${value}`)).join("\n")}   
    `);
  }

  return transform as typeof transformOptions[number]["value"];
};
