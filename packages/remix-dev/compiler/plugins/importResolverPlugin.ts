// based on https://github.com/linjiajian999/esbuild-plugin-import with a smaller feature-set

import path from "path";
import type { Loader, Plugin } from "esbuild";
import fse from "fs-extra";

export interface EsbuildPluginImportOption {
  libraryName: string;
  ignoreImports?: (RegExp | string)[];
}

export const transCamel = (str: string, symbol: string) => {
  let _str = str[0].toLowerCase() + str.substr(1);
  return _str.replace(/([A-Z])/g, ($1) => `${symbol}${$1.toLowerCase()}`);
};

export const transWinPath = (modulePath: string) => {
  return modulePath.replace(/\\/g, "/");
};

const importReg = /^import\s+{((?:.|\n)*?)}\s+from\s+['"](.*?)['"];?/m;

const generateImportExpression = (
  importExpressionInfo: {
    importExpression: string;
    memberString: string;
    libraryString: string;
  },
  config: EsbuildPluginImportOption
) => {
  let { memberString, libraryString } = importExpressionInfo;
  let { ignoreImports } = config;

  let importLines = [];
  let members = memberString
    .replace(/\/\/.*/gm, "") // ignore comments `//`
    .replace(/\/\*(.|\n)*?\*\//gm, "") // ignore comments `/* */`
    .split(",")
    .map((v) => v.replace(/(^\s+|\s+$)/g, ""))
    .filter(Boolean);

  let ignoreImportNames = [];

  for (let member of members) {
    let [rawMemberName, aliasMemberName] = member.split(/\s+as\s+/);
    let memberName = aliasMemberName || rawMemberName;

    if (ignoreImports?.length) {
      let isIgnore = ignoreImports.some((ignoreReg) => {
        if (typeof ignoreReg === "string") {
          return ignoreReg === rawMemberName;
        }
        return ignoreReg.test(rawMemberName);
      });
      if (isIgnore) {
        ignoreImportNames.push(member);
        continue;
      }
    }

    let transformedMemberName = transCamel(rawMemberName, "-");

    let memberImportDirectory = path.join(libraryString, transformedMemberName);

    importLines.push(`import {${memberName}} from "${memberImportDirectory}";`);
  }

  if (ignoreImportNames.length) {
    importLines.push(
      `import {${ignoreImportNames.join(",")}} from "${libraryString}";`
    );
  }

  return importLines.map((line) => transWinPath(line)).join("\n");
};

const generateNewContent = (
  content: string,
  libraryConfigMap: Record<string, EsbuildPluginImportOption>
) => {
  let newContent = "";
  let matchContent = content;

  while (true) {
    let matches = importReg.exec(matchContent);

    if (!matches) break;

    let [importExpression, memberString, libraryString] = matches;

    let config = libraryConfigMap[libraryString];

    if (config) {
      newContent += matchContent.substring(0, matches.index);

      newContent += generateImportExpression(
        { importExpression, memberString, libraryString },
        config
      );
    } else {
      newContent += matchContent.substring(
        0,
        matches.index + importExpression.length
      );
    }

    matchContent = matchContent.substring(
      matches.index + importExpression.length,
      matchContent.length
    );
  }
  newContent += matchContent;

  return newContent;
};

export function importResolverPlugin(
  options: EsbuildPluginImportOption[] = []
): Plugin {
  return {
    name: "esbuild-plugin-import",
    setup(build) {
      let filter = /([t|j]sx?|[m|c][t|j]s)$/;

      let libraryConfigMap = options.reduce((pre, option) => {
        if (option.libraryName) {
          pre[option.libraryName] = option;
        }
        return pre;
      }, {} as Record<string, EsbuildPluginImportOption>);

      build.onLoad({ filter }, async (args) => {
        let { path: filePath, namespace } = args;

        let fileContent = "";

        if (namespace === "file") {
          let fileContentBuffer = await fse.readFile(filePath);
          fileContent = fileContentBuffer.toString();
        }

        let content = generateNewContent(fileContent, libraryConfigMap);

        let extension = path.extname(filePath).replace(".", "");

        let jsExtensions = ["mjs", "cjs"];
        let tsExtensions = ["mts", "cts"];

        let loader = (
          jsExtensions.includes(extension)
            ? "js"
            : tsExtensions.includes(extension)
            ? "ts"
            : extension
        ) as Loader;

        return {
          contents: content,
          loader,
        };
      });
      return undefined;
    },
  };
}
