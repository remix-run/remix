import fs from "fs";
import path from "path";

import type { ConfigRouteObject, DefineRoute } from "./routes";
import { defineRoutes, createRouteId } from "./routes";
import { isModuleFile } from "./rollup/routeModules";
import { isStylesFile } from "./rollup/styles";
import invariant from "./invariant";

/**
 * Defines routes using the filesystem convention in `app/routes`. The rules are:
 *
 * - Route paths are derived from the file path. A `.` in the filename indicates
 *   a `/` in the URL (a "nested" URL, but no route nesting). A `$` in the
 *   filename indicates a dynamic URL segment.
 * - Subdirectories are used for nested routes.
 *
 * For example, a file named `app/routes/gists/$username.tsx` creates a route
 * with a path of `gists/:username`.
 */
export function defineConventionalRoutes(appDir: string): ConfigRouteObject[] {
  let routeFiles: {
    [routeId: string]: {
      module?: string;
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
      let { module, styles } = routeFiles[routeId];

      invariant(module, `Missing module for route id "${routeId}"`);

      defineRoute(routePath, module, { styles }, () => {
        defineNestedRoutes(defineRoute, routeId);
      });
    }
  }

  // First, find all route modules & styles in app/routes
  visitFiles(path.join(appDir, "routes"), file => {
    let files = findOrCreateFiles(path.join("routes", file));

    if (isModuleFile(file)) {
      files.module = path.join("routes", file);
    } else if (isStylesFile(file)) {
      files.styles = path.join("routes", file);
    } else {
      throw new Error(
        `Invalid route component file: ${path.join(appDir, "routes", file)}`
      );
    }
  });

  // Then define them all
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
