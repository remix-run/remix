import fs from "node:fs/promises";
import path from "node:path";
import {
  UNSAFE_flatRoutes as flatRoutesImpl,
  UNSAFE_routeManifestToRouteConfig as routeManifestToRouteConfig,
} from "@remix-run/dev";
import {
  type RouteConfigEntry,
  getAppDirectory,
} from "@remix-run/route-config";

/**
 * Creates route config from the file system that matches [Remix's default file
 * conventions](https://remix.run/docs/en/v2/file-conventions/routes), for
 * use within `routes.ts`.
 */
export async function flatRoutes(
  options: {
    ignoredRouteFiles?: string[];
    rootDirectory?: string;
  } = {}
): Promise<RouteConfigEntry[]> {
  const { ignoredRouteFiles = [], rootDirectory: userRootDirectory = "routes" } = options;
  const appDirectory = getAppDirectory();
  const rootDirectory = path.resolve(appDirectory, userRootDirectory);
  const relativeRootDirectory = path.relative(appDirectory, rootDirectory);
  const prefix = normalizeSlashes(relativeRootDirectory);

  try {
    const directoryExists = await fs.access(rootDirectory).then(() => true).catch(() => false);

    const routes = directoryExists
      ? flatRoutesImpl(appDirectory, ignoredRouteFiles, prefix)
      : {};

    return routeManifestToRouteConfig(routes);
  } catch (error) {
    console.error("Error generating route config:", error);
    throw new Error("Failed to generate route config. See logs for details.");
  }
}

/**
 * Normalizes path slashes to forward slashes.
 *
 * @param file - The file path to normalize.
 * @returns The normalized file path with forward slashes.
 */
function normalizeSlashes(file: string): string {
  return file.split(path.win32.sep).join("/");
}
