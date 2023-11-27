import * as path from "node:path";

export const resolveFileUrl = (
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  vite: typeof import("vite"),
  { rootDirectory }: { rootDirectory: string },
  filePath: string
) => {
  let relativePath = path.relative(rootDirectory, filePath);
  let isWithinRoot =
    !relativePath.startsWith("..") && !path.isAbsolute(relativePath);

  if (!isWithinRoot) {
    // Vite will prevent serving files outside of the workspace
    // unless user explictly opts in with `server.fs.allow`
    // https://vitejs.dev/config/server-options.html#server-fs-allow
    return path.posix.join("/@fs", vite.normalizePath(filePath));
  }

  return "/" + vite.normalizePath(relativePath);
};
