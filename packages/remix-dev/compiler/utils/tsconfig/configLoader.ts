import * as path from "path";

import invariant from "../../../invariant";
import { tsConfigLoader } from "./tsConfigLoader";

export interface ConfigLoaderParams {
  cwd: string;
}

export interface ConfigLoaderSuccessResult {
  resultType: "success";
  configFileAbsolutePath: string;
  baseUrl: string;
  absoluteBaseUrl: string;
  paths: { [key: string]: Array<string> };
  mainFields?: Array<string>;
  addMatchAll?: boolean;
}

export interface ConfigLoaderFailResult {
  resultType: "failed";
  message: string;
}

export type ConfigLoaderResult =
  | ConfigLoaderSuccessResult
  | ConfigLoaderFailResult;

export function loadTsConfig(cwd: string = process.cwd()): ConfigLoaderResult {
  return configLoader({ cwd });
}

export function configLoader({ cwd }: ConfigLoaderParams): ConfigLoaderResult {
  // Load tsconfig and create path matching function
  let loadResult = tsConfigLoader({
    cwd,
    getEnv: (key: string) => process.env[key],
  });

  if (!loadResult.tsConfigPath) {
    return {
      resultType: "failed",
      message: "Couldn't find tsconfig.json or jsconfig.json",
    };
  }

  // we should have already configured the baseUrl by now
  invariant(loadResult.baseUrl, "baseUrl is required, but was not set");

  let tsConfigDir = path.dirname(loadResult.tsConfigPath);
  let absoluteBaseUrl = path.join(tsConfigDir, loadResult.baseUrl);

  return {
    resultType: "success",
    configFileAbsolutePath: loadResult.tsConfigPath,
    baseUrl: loadResult.baseUrl,
    absoluteBaseUrl,
    paths: loadResult.paths || {},
  };
}
