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

  if (config) {
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

    // These are suggested values and will be set when not present in the
    // tsconfig.json
    if (
      typeof config.compilerOptions.forceConsistentCasingInFileNames ===
      "undefined"
    ) {
      config.compilerOptions.forceConsistentCasingInFileNames = true;
      suggestedChanges.push(
        colors.blue("compilerOptions.forceConsistentCasingInFileNames") +
          " was set to " +
          colors.bold(`true`)
      );
    }
    if (typeof config.compilerOptions.target === "undefined") {
      config.compilerOptions.target = "es2019";
      suggestedChanges.push(
        colors.blue("compilerOptions.target") +
          " was set to " +
          colors.bold("es2019")
      );
    }
    if (typeof config.compilerOptions.lib === "undefined") {
      config.compilerOptions.lib = ["DOM", "DOM.Iterable", "es2019"];
      suggestedChanges.push(
        colors.blue("compilerOptions.lib") +
          " was set to " +
          colors.bold(`['DOM', 'DOM.Iterable', 'es2019']`)
      );
    }
    if (typeof config.compilerOptions.allowJs === "undefined") {
      config.compilerOptions.allowJs = true;
      suggestedChanges.push(
        colors.blue("compilerOptions.allowJs") +
          " was set to " +
          colors.bold("true")
      );
    }
    if (typeof config.compilerOptions.strict === "undefined") {
      config.compilerOptions.strict = true;
      suggestedChanges.push(
        colors.blue("compilerOptions.strict") +
          " was set to " +
          colors.bold("true")
      );
    }
    if (typeof config.compilerOptions.baseUrl === "undefined") {
      let baseUrl = path.relative(cwd, path.dirname(configPath)) || ".";
      config.compilerOptions!.baseUrl = baseUrl;
      suggestedChanges.push(
        colors.blue("compilerOptions.baseUrl") +
          " was set to " +
          colors.bold(`'${baseUrl}'`)
      );
    }

    // These values are required and cannot be changed by the user
    // Keep this in sync with esbuild
    if (config.compilerOptions.esModuleInterop !== true) {
      config.compilerOptions.esModuleInterop = true;
      requiredChanges.push(
        colors.blue("compilerOptions.esModuleInterop") +
          " was set to " +
          colors.bold("true")
      );
    }
    if (config.compilerOptions.isolatedModules !== true) {
      config.compilerOptions.isolatedModules = true;
      requiredChanges.push(
        colors.blue("compilerOptions.isolatedModules") +
          " was set to " +
          colors.bold("true")
      );
    }
    if (config.compilerOptions.jsx !== "react-jsx") {
      config.compilerOptions.jsx = "react-jsx";
      requiredChanges.push(
        colors.blue("compilerOptions.jsx") +
          " was set to " +
          colors.bold("react-jsx")
      );
    }
    if (config.compilerOptions.moduleResolution !== "node") {
      config.compilerOptions.moduleResolution = "node";
      requiredChanges.push(
        colors.blue("compilerOptions.moduleResolution") +
          " was set to " +
          colors.bold("node")
      );
    }
    if (config.compilerOptions.resolveJsonModule !== true) {
      config.compilerOptions.resolveJsonModule = true;
      requiredChanges.push(
        colors.blue("compilerOptions.resolveJsonModule") +
          " was set to " +
          colors.bold("true")
      );
    }
    if (config.compilerOptions.noEmit !== true) {
      config.compilerOptions.noEmit = true;
      requiredChanges.push(
        colors.blue("compilerOptions.noEmit") +
          " was set to " +
          colors.bold("true")
      );
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
  let configPath = path.join(directory, "./tsconfig.json");
  if (existsSync(configPath)) {
    return configPath;
  }

  configPath = path.join(directory, "./jsconfig.json");
  if (existsSync(configPath)) {
    return configPath;
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
