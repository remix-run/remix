import * as path from "path";
import os from "os";

export async function getFullTsConfig(configPath: string) {
  let { default: ts } = await import("typescript");

  let lConfig = ts.readConfigFile(configPath, ts.sys.readFile);

  // this will be the *full* tsconfig.json with any extensions deeply merged
  let fullConfig = ts.parseJsonConfigFileContent(
    lConfig.config,
    ts.sys,
    path.dirname(configPath)
  );
  if (fullConfig.errors.length) {
    console.log(fullConfig.errors);
    throw new Error(
      ts.formatDiagnostic(fullConfig.errors?.[0], {
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => os.EOL,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
      })
    );
  }
  return { fullConfig, ts };
}
