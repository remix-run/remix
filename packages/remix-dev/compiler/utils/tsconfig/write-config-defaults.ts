import * as path from "path";
import fse from "fs-extra";
import type { TsConfigJson } from "type-fest";
import prettier from "prettier";
import JSON5 from "json5";

import * as colors from "../../../colors";
import { getFullTsConfig } from "./getFullTsConfig";

// taken from https://github.com/sindresorhus/ts-extras/blob/781044f0412ec4a4224a1b9abce5ff0eacee3e72/source/object-keys.ts
type ObjectKeys<T extends object> = `${Exclude<keyof T, symbol>}`;
function objectKeys<Type extends object>(value: Type): Array<ObjectKeys<Type>> {
  return Object.keys(value) as Array<ObjectKeys<Type>>;
}

export async function writeConfigDefaults(configPath: string) {
  // check files exist
  if (!fse.existsSync(configPath)) return;

  let { fullConfig, ts } = await getFullTsConfig(configPath);

  // These are suggested values and will be set when not present in the
  // tsconfig.json
  let suggestedCompilerOptions: {
    [key in keyof TsConfigJson.CompilerOptions]: {
      kind?: any;
      value: TsConfigJson.CompilerOptions[key];
    };
  } = {
    allowJs: { value: true },
    forceConsistentCasingInFileNames: { value: true },
    lib: { value: ["DOM", "DOM.Iterable", "ES2019"] },
    strict: { value: true },
    target: { kind: ts.ScriptTarget.ES2019, value: "ES2019" },
  };

  // These values are required and cannot be changed by the user
  // Keep this in sync with esbuild
  let requiredCompilerOptions: {
    [key in keyof TsConfigJson.CompilerOptions]: {
      kind?: any;
      value: TsConfigJson.CompilerOptions[key];
    };
  } = {
    esModuleInterop: { value: true },
    isolatedModules: { value: true },
    jsx: { kind: ts.JsxEmit.ReactJSX, value: "react-jsx" },
    noEmit: { value: true },
    resolveJsonModule: { value: true },
  };

  // this will be the user's actual tsconfig file
  let configContents = fse.readFileSync(configPath, "utf8");

  let config: TsConfigJson | undefined;
  try {
    config = JSON5.parse(configContents);
  } catch (error: unknown) {}

  if (!config) {
    // how did we get here? we validated a tsconfig existed in the first place
    console.warn(
      "This should never happen, please open an issue with a reproduction https://github.com/remix-run/remix/issues/new"
    );
    return;
  }

  let configType = path.basename(configPath) as
    | "jsconfig.json"
    | "tsconfig.json";

  // sanity checks to make sure we can write the compilerOptions
  if (!config.compilerOptions) config.compilerOptions = {};

  let suggestedChanges = [];
  let requiredChanges = [];

  if (!("include" in fullConfig.raw)) {
    if (configType === "jsconfig.json") {
      config.include = ["**/*.js", "**/*.jsx"];
      suggestedChanges.push(
        colors.blue("include") +
          " was set to " +
          colors.bold(`['**/*.js', '**/*.jsx']`)
      );
    } else {
      config.include = ["remix.env.d.ts", "**/*.ts", "**/*.tsx"];
      suggestedChanges.push(
        colors.blue("include") +
          " was set to " +
          colors.bold(`['remix.env.d.ts', '**/*.ts', '**/*.tsx']`)
      );
    }
  }
  // TODO: check for user's typescript version and only add baseUrl if < 4.1
  if (!("baseUrl" in fullConfig.options)) {
    let baseUrl = path.relative(process.cwd(), path.dirname(configPath)) || ".";
    config.compilerOptions.baseUrl = baseUrl;
    requiredChanges.push(
      colors.blue("compilerOptions.baseUrl") +
        " was set to " +
        colors.bold(`'${baseUrl}'`)
    );
  }
  for (let key of objectKeys(suggestedCompilerOptions)) {
    if (!(key in fullConfig.options)) {
      config.compilerOptions[key] = suggestedCompilerOptions[key]?.value as any;
      suggestedChanges.push(
        colors.blue("compilerOptions." + key) +
          " was set to " +
          colors.bold(`'${suggestedCompilerOptions[key]?.value}'`)
      );
    }
  }

  for (let key of objectKeys(requiredCompilerOptions)) {
    let shouldPush = false;
    if ("kind" in (requiredCompilerOptions[key] || {})) {
      if (fullConfig.options[key] !== requiredCompilerOptions[key]?.kind) {
        shouldPush = true;
        config.compilerOptions[key] = requiredCompilerOptions[key]
          ?.value as any;
      }
    } else {
      if (fullConfig.options[key] !== requiredCompilerOptions[key]?.value) {
        shouldPush = true;
        config.compilerOptions[key] = requiredCompilerOptions[key]
          ?.value as any;
      }
    }
    if (shouldPush) {
      requiredChanges.push(
        colors.blue("compilerOptions." + key) +
          " was set to " +
          colors.bold(`'${requiredCompilerOptions[key]?.value}'`)
      );
    }
  }

  if (fullConfig.options.moduleResolution) {
    let configModuleResolution =
      ts.ModuleResolutionKind[fullConfig.options.moduleResolution];

    if (
      !["nodejs", "node16", "nodenext"].includes(
        configModuleResolution.toLowerCase()
      )
    ) {
      config.compilerOptions.moduleResolution = "node";
      requiredChanges.push(
        colors.blue("compilerOptions.moduleResolution") +
          " was set to " +
          colors.bold(`'node'`)
      );
    }
  } else {
    config.compilerOptions.moduleResolution = "node";
    requiredChanges.push(
      colors.blue("compilerOptions.moduleResolution") +
        " was set to " +
        colors.bold(`'node'`)
    );
  }

  if (suggestedChanges.length > 0 || requiredChanges.length > 0) {
    fse.writeFileSync(
      configPath,
      prettier.format(JSON.stringify(config, null, 2), {
        parser: "json",
      })
    );
  }
  if (suggestedChanges.length > 0) {
    console.log(
      `The following suggested values were added to your ${colors.blue(
        `"${configType}"`
      )}. These values ${colors.bold(
        "can be changed"
      )} to fit your project's needs:\n`
    );

    suggestedChanges.forEach((change) => console.log(`\t- ${change}`));
    console.log("");
  }

  if (requiredChanges.length > 0) {
    console.log(
      `The following ${colors.bold(
        "mandatory changes"
      )} were made to your ${colors.blue(configType)}:\n`
    );

    requiredChanges.forEach((change) => console.log(`\t- ${change}`));
    console.log("");
  }
}
