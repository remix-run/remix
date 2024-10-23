import PackageJson from "@npmcli/package-json";

/**
 * Attempt to load the project's package.json if it exists.
 * This likely won't be present in a Deno project.
 */
export const tryLoadPackageJson = async (rootDirectory: string) => {
  try {
    let pkgJson = await PackageJson.load(rootDirectory);
    return pkgJson;
  } catch {
    return undefined;
  }
};
