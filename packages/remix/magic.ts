import * as fse from "fs-extra";
import * as path from "path";

export async function installMagicExports(
  dependencies: { [name: string]: string },
  filesDir: string
): Promise<void> {
  let remixDir = path.dirname(require.resolve("remix"));
  let packageJsonFile = path.resolve(remixDir, "package.json");

  console.log(
    `Copying files from ${path.relative(
      process.cwd(),
      filesDir
    )} to ${path.relative(process.cwd(), remixDir)}...`
  );
  await fse.copy(filesDir, remixDir);

  console.log(
    `Adding ${Object.keys(dependencies).join(", ")} to remix's dependencies...`
  );
  await fse.writeJson(
    packageJsonFile,
    assignDependencies(await fse.readJson(packageJsonFile), dependencies),
    { spaces: 2 }
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
