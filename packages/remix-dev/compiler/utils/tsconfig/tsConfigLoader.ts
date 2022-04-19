import * as path from "path";
import * as fse from "fs-extra";
import JSON5 from "json5";
import stripBom from "strip-bom";
import type { TsConfigJson } from "type-fest";

import * as colors from "../../../colors";

export interface TsConfigLoaderResult {
  tsConfigPath: string | undefined;
  baseUrl: string | undefined;
  paths: { [key: string]: Array<string> } | undefined;
}

export interface TsConfigLoaderParams {
  getEnv: (key: string) => string | undefined;
  cwd: string;
  loadSync?(
    cwd: string,
    filename?: string,
    baseUrl?: string
  ): TsConfigLoaderResult;
}

export function tsConfigLoader({
  cwd,
}: TsConfigLoaderParams): TsConfigLoaderResult {
  let loadResult = loadSync(cwd);
  return loadResult;
}

// These are suggested values and will be set when not present in the
// tsconfig.json
let suggestedCompilerOptions: TsConfigJson.CompilerOptions = {
  forceConsistentCasingInFileNames: true,
  target: "es2019",
  lib: ["DOM", "DOM.Iterable", "ES2019"] as TsConfigJson.CompilerOptions.Lib[],
  allowJs: true,
  strict: true,
  paths: {
    "~/*": ["./app/*"],
  },
};

// These values are required and cannot be changed by the user
// Keep this in sync with esbuild
let requiredCompilerOptions: TsConfigJson.CompilerOptions = {
  esModuleInterop: true,
  isolatedModules: true,
  jsx: "react-jsx",
  moduleResolution: "node",
  resolveJsonModule: true,
  noEmit: true,
};

// taken from https://github.com/sindresorhus/ts-extras/blob/781044f0412ec4a4224a1b9abce5ff0eacee3e72/source/object-keys.ts
export type ObjectKeys<T extends object> = `${Exclude<keyof T, symbol>}`;
export function objectKeys<Type extends object>(
  value: Type
): Array<ObjectKeys<Type>> {
  return Object.keys(value) as Array<ObjectKeys<Type>>;
}

function loadSync(cwd: string): TsConfigLoaderResult {
  // Tsconfig.loadSync uses path.resolve. This is why we can use an absolute path as filename
  let configPath = resolveConfigPath(cwd);
  if (!configPath) {
    return {
      tsConfigPath: undefined,
      baseUrl: undefined,
      paths: undefined,
    };
  }

  let config = parseTsConfig(configPath);
  if (!config) {
    return {
      tsConfigPath: undefined,
      baseUrl: undefined,
      paths: undefined,
    };
  }

  let configType = path.basename(configPath);
  if (!config.compilerOptions) {
    config.compilerOptions = {};
  }

  let suggestedChanges = [];
  let requiredChanges = [];

  if (!("include" in config)) {
    config.include = ["remix.env.d.ts", "**/*.ts", "**/*.tsx"];
    suggestedChanges.push(
      colors.blue("include") +
        " was set to " +
        colors.bold(`['remix.env.d.ts', '**/*.ts', '**/*.tsx']`)
    );
  }

  if (typeof config.compilerOptions.baseUrl === "undefined") {
    let baseUrl = path.relative(cwd, path.dirname(configPath)) || ".";
    config.compilerOptions.baseUrl = baseUrl;
    requiredChanges.push(
      colors.blue("compilerOptions.baseUrl") +
        " was set to " +
        colors.bold(`'${baseUrl}'`)
    );
  }

  for (let key of objectKeys(suggestedCompilerOptions)) {
    // we check for config and config.compilerOptions above...
    if (!(key in config.compilerOptions)) {
      config.compilerOptions[key] = suggestedCompilerOptions[key] as any;
      suggestedChanges.push(
        colors.blue("compilerOptions." + key) +
          " was set to " +
          colors.bold(`'${suggestedCompilerOptions[key]}'`)
      );
    }
  }

  for (let key of objectKeys(requiredCompilerOptions)) {
    if (config.compilerOptions[key] !== requiredCompilerOptions[key]) {
      config!.compilerOptions![key] = requiredCompilerOptions[key] as any;
      requiredChanges.push(
        colors.blue("compilerOptions." + key) +
          " was set to " +
          colors.bold(`'${requiredCompilerOptions[key]}'`)
      );
    }
  }

  if (suggestedChanges.length > 0 || requiredChanges.length > 0) {
    fse.writeJSONSync(configPath, config, { spaces: 2 });
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

  return {
    tsConfigPath: configPath,
    baseUrl: config?.compilerOptions?.baseUrl,
    paths: config?.compilerOptions?.paths,
  };
}

function resolveConfigPath(cwd: string): string | undefined {
  if (fse.statSync(cwd).isFile()) {
    return path.resolve(cwd);
  }

  let configAbsolutePath = walkForTsConfig(cwd);
  return configAbsolutePath ? path.resolve(configAbsolutePath) : undefined;
}

function walkForTsConfig(
  directory: string,
  existsSync: (path: string) => boolean = fse.existsSync
): string | undefined {
  let tsconfigPath = path.join(directory, "./tsconfig.json");
  if (existsSync(tsconfigPath)) {
    return tsconfigPath;
  }

  let jsconfigPath = path.join(directory, "./jsconfig.json");
  if (existsSync(jsconfigPath)) {
    return jsconfigPath;
  }

  let parentDirectory = path.join(directory, "../");

  // If we reached the top
  if (directory === parentDirectory) {
    return undefined;
  }

  return walkForTsConfig(parentDirectory, existsSync);
}

function parseTsConfig(
  configFilePath: string,
  existsSync: (path: string) => boolean = fse.existsSync,
  readFileSync: (filename: string) => string = (filename: string) =>
    fse.readFileSync(filename, "utf8")
): TsConfigJson | undefined {
  if (!existsSync(configFilePath)) {
    return undefined;
  }

  let configString = readFileSync(configFilePath);
  let cleanedJson = stripBom(configString);
  let config = JSON5.parse<TsConfigJson>(cleanedJson);
  let extendedConfig = config.extends;

  if (extendedConfig) {
    if (
      typeof extendedConfig === "string" &&
      extendedConfig.indexOf(".json") === -1
    ) {
      extendedConfig += ".json";
    }
    let currentDir = path.dirname(configFilePath);
    let extendedConfigPath = path.join(currentDir, extendedConfig);
    if (
      extendedConfig.indexOf("/") !== -1 &&
      extendedConfig.indexOf(".") !== -1 &&
      !existsSync(extendedConfigPath)
    ) {
      extendedConfigPath = path.join(
        currentDir,
        "node_modules",
        extendedConfig
      );
    }

    let base =
      parseTsConfig(extendedConfigPath, existsSync, readFileSync) || {};

    // baseUrl should be interpreted as relative to the base tsconfig,
    // but we need to update it so it is relative to the original tsconfig being loaded
    if (base.compilerOptions && base.compilerOptions.baseUrl) {
      let extendsDir = path.dirname(extendedConfig);
      base.compilerOptions.baseUrl = path.join(
        extendsDir,
        base.compilerOptions.baseUrl
      );
    }

    return {
      ...base,
      ...config,
      compilerOptions: {
        ...base.compilerOptions,
        ...config.compilerOptions,
      },
    };
  }
  return config;
}
