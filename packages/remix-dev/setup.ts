import * as path from "path";
import * as fse from "fs-extra";

export enum SetupPlatform {
  CloudflarePages = "cloudflare-pages",
  CloudflareWorkers = "cloudflare-workers",
  Node = "node"
}

export function isSetupPlatform(platform: any): platform is SetupPlatform {
  return [
    SetupPlatform.CloudflarePages,
    SetupPlatform.CloudflareWorkers,
    SetupPlatform.Node
  ].includes(platform);
}

export async function setupRemix(platform: SetupPlatform): Promise<void> {
  let remixPkgJsonFile: string;
  try {
    remixPkgJsonFile = resolvePackageJsonFile("remix");
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND") {
      console.error(
        `Missing the "remix" package. Please run \`npm install remix\` before \`remix setup\`.`
      );

      return;
    } else {
      throw error;
    }
  }

  const platformPkgJsonFile = resolvePackageJsonFile(`@remix-run/${platform}`);
  const serverPkgJsonFile = resolvePackageJsonFile(`@remix-run/server-runtime`);
  const clientPkgJsonFile = resolvePackageJsonFile(`@remix-run/react`);

  // Update remix/package.json dependencies
  const remixDeps = {};
  await assignDependency(remixDeps, platformPkgJsonFile);
  await assignDependency(remixDeps, serverPkgJsonFile);
  await assignDependency(remixDeps, clientPkgJsonFile);

  const remixPkgJson = await fse.readJSON(remixPkgJsonFile);
  // We can overwrite all dependencies at once because the remix package
  // doesn't actually have any dependencies.
  remixPkgJson.dependencies = remixDeps;

  await fse.writeJSON(remixPkgJsonFile, remixPkgJson, { spaces: 2 });

  // Copy magicExports directories to remix
  const remixPkgDir = path.dirname(remixPkgJsonFile);
  const platformExportsDir = path.resolve(
    platformPkgJsonFile,
    "..",
    "magicExports"
  );
  const serverExportsDir = path.resolve(serverPkgJsonFile, "..", "magicExports");
  const clientExportsDir = path.resolve(clientPkgJsonFile, "..", "magicExports");

  await Promise.all([
    fse.copy(platformExportsDir, remixPkgDir),
    fse.copy(serverExportsDir, remixPkgDir),
    fse.copy(clientExportsDir, remixPkgDir)
  ]);
}

function resolvePackageJsonFile(packageName: string): string {
  return require.resolve(path.join(packageName, "package.json"));
}

async function assignDependency(
  deps: { [key: string]: string },
  pkgJsonFile: string
) {
  const pkgJson = await fse.readJSON(pkgJsonFile);
  deps[pkgJson.name] = pkgJson.version;
}
