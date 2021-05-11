import * as fse from "fs-extra";
import * as path from "path";

export async function installMagicExports(
  sourceDir: string,
  dependencies: { [name: string]: string }
): Promise<void> {
  let remixDir = path.dirname(require.resolve("remix"));
  let packageJsonFile = path.resolve(remixDir, "package.json");

  await fse.copy(sourceDir, remixDir);
  await writeJson(
    packageJsonFile,
    assignDependencies(readJson(packageJsonFile), dependencies)
  );
}

function assignDependencies(
  object: any,
  dependencies: { [name: string]: string }
): typeof object {
  if (!object.dependencies) {
    object.dependencies = {};
  }

  Object.assign(object.dependencies, dependencies);

  return object;
}

async function readJson(file: string): Promise<any> {
  return JSON.parse((await fse.readFile(file)).toString());
}

async function writeJson(file: string, contents: any): Promise<void> {
  await fse.writeFile(file, JSON.stringify(contents, null, 2));
}
