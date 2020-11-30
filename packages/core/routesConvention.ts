import fs from "fs";
import path from "path";

import type { ConfigRouteObject, DefineRoute } from "./routes";
import { defineRoutes, createRouteId } from "./routes";

/**
 * Defines routes using the filesystem convention.
 *
 * Routes are stored in two locations: `app/routes` and `data/routes`.
 * Subdirectories are used for nested routes.
 *
 * Route paths are derived from the file path. A `.` in the filename indicates
 * a `/` in the URL (a "nested" URL) but no route nesting. A `$` in the
 * filename may be used for dynamic URL segments.
 *
 * For example, a file named `app/routes/gists/$username.tsx` creates a route
 * with a path of `gists/:username`.
 */
export function defineConventionalRoutes(
  appDir: string,
  dataDir: string
): ConfigRouteObject[] {
  let routeFiles: {
    [routeId: string]: {
      component?: string;
      loader?: string;
      styles?: string;
    };
  } = {};

  function findOrCreateFiles(file: string): typeof routeFiles[string] {
    let id = createRouteId(file);
    return routeFiles[id] || (routeFiles[id] = {});
  }

  function defineNestedRoutes(
    defineRoute: DefineRoute,
    parentRouteId?: string
  ) {
    let routeIds = Object.keys(routeFiles);
    let childRouteIds = routeIds.filter(
      id => findParentRouteId(routeIds, id) === parentRouteId
    );

    for (let routeId of childRouteIds) {
      let routePath = createRoutePath(
        routeId.slice((parentRouteId || "routes").length + 1)
      );
      let { component, loader, styles } = routeFiles[routeId];

      defineRoute(routePath, component, { loader, styles }, () => {
        defineNestedRoutes(defineRoute, routeId);
      });
    }
  }

  // First, find all routes/styles defined in app/routes
  visitFiles(path.join(appDir, "routes"), file => {
    let files = findOrCreateFiles(path.join("routes", file));

    if (isComponentFile(file)) {
      files.component = path.join("routes", file);
    } else if (isStylesFile(file)) {
      files.styles = path.join("routes", file);
    } else {
      throw new Error(
        `Invalid route component file: ${path.join(appDir, "routes", file)}`
      );
    }
  });

  // Then find all routes defined in data/routes
  visitFiles(path.join(dataDir, "routes"), file => {
    let files = findOrCreateFiles(path.join("routes", file));

    if (isLoaderFile(file)) {
      files.loader = path.join("routes", file);
    } else {
      throw new Error(
        `Invalid route loader file: ${path.join(dataDir, "routes", file)}`
      );
    }
  });

  // Finally, recurse through the manifest and define them all
  return defineRoutes(defineNestedRoutes);
}

function createRoutePath(routeId: string): string {
  let path = routeId.replace(/\$/g, ":").replace(/\./g, "/");
  return /\b\/?index$/.test(path) ? path.replace(/\/?index$/, "") : path;
}

function findParentRouteId(
  routeIds: string[],
  childRouteId: string
): string | undefined {
  return routeIds
    .slice(0)
    .sort(byLongestFirst)
    .find(id => childRouteId.startsWith(`${id}/`));
}

function byLongestFirst(a: string, b: string): number {
  return b.length - a.length;
}

const componentExts = [".cjs", ".md", ".mdx", ".js", ".jsx", ".ts", ".tsx"];

export function isComponentFile(filename: string): boolean {
  return componentExts.includes(path.extname(filename));
}

const loaderExts = [".cjs", ".js", ".jsx", ".ts", ".tsx"];

export function isLoaderFile(filename: string): boolean {
  return loaderExts.includes(path.extname(filename));
}

const stylesExts = [".css"];

export function isStylesFile(filename: string): boolean {
  return stylesExts.includes(path.extname(filename));
}

function visitFiles(
  dir: string,
  visitor: (file: string) => void,
  baseDir = dir
): void {
  for (let filename of fs.readdirSync(dir)) {
    let file = path.resolve(dir, filename);
    let stat = fs.lstatSync(file);

    if (stat.isDirectory()) {
      visitFiles(file, visitor, baseDir);
    } else if (stat.isFile()) {
      visitor(path.relative(baseDir, file));
    }
  }
}
