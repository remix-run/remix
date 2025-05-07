import path from "node:path";

export function isInRemixMonorepo() {
  try {
    let devPath = path.dirname(require.resolve("@remix-run/node/package.json"));
    let devParentDir = path.basename(path.resolve(devPath, ".."));
    return devParentDir === "packages";
  } catch {
    return false;
  }
}
