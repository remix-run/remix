import path from "node:path";
import fg from "fast-glob";

import type { ConfigRoute, DefineRouteFunction, RouteManifest } from "./routes";
import { createRouteId, defineRoutes } from "./routes";
import {
  escapeEnd,
  escapeStart,
  isSegmentSeparator,
  optionalEnd,
  optionalStart,
  paramPrefixChar,
  routeModuleExts,
} from "./routesConvention";

export function flatRoutes(
  appDirectory: string,
  ignoredFilePatterns?: string[]
): RouteManifest {
  let extensions = routeModuleExts.join(",");

  let routePaths = fg.sync(`*{${extensions}}`, {
    absolute: true,
    cwd: path.join(appDirectory, "routes"),
    ignore: ignoredFilePatterns,
  });

  return flatRoutesUniversal(appDirectory, routePaths);
}

interface RouteInfo extends ConfigRoute {
  name: string;
  segments: string[];
}

/**
 * Create route configs from a list of routes using the flat routes conventions.
 * @param {string} appDirectory - The absolute root directory the routes were looked up from.
 * @param {string[]} routePaths - The absolute route paths.
 * @param {string} [prefix=routes] - The prefix to strip off of the routes.
 */
export function flatRoutesUniversal(
  appDirectory: string,
  routePaths: string[],
  prefix: string = "routes"
): RouteManifest {
  let routeMap = new Map<string, RouteInfo>();
  let nameMap = new Map<string, RouteInfo>();

  for (let routePath of routePaths) {
    let routeInfo = getRouteInfo(appDirectory, prefix, routePath);
    routeMap.set(routeInfo.id, routeInfo);
    nameMap.set(routeInfo.name, routeInfo);
  }

  // update parentIds for all routes
  for (let routeInfo of routeMap.values()) {
    let parentId = findParentRouteId(routeInfo, nameMap);
    routeInfo.parentId = parentId;
  }

  let uniqueRoutes = new Map<string, string>();

  function defineNestedRoutes(
    defineRoute: DefineRouteFunction,
    parentId?: string
  ): void {
    let childRoutes = Array.from(routeMap.values()).filter(
      (routeInfo) => routeInfo.parentId === parentId
    );
    let parentRoute = parentId ? routeMap.get(parentId) : undefined;
    let parentRoutePath = parentRoute?.path ?? "/";
    for (let childRoute of childRoutes) {
      let routePath = childRoute?.path?.slice(parentRoutePath.length) ?? "";
      // remove leading slash
      if (routePath.startsWith("/")) {
        routePath = routePath.slice(1);
      }
      let index = childRoute.index;
      let fullPath = childRoute.path;

      // add option to check for unique route ids
      // this is copied from remix default convention
      // but it is currently breaking some flat routes
      // so until we can figure out a better way to do this
      // make it optional to unblock users
      let uniqueRouteId = (fullPath || "") + (index ? "?index" : "");
      if (uniqueRouteId) {
        let conflict = uniqueRoutes.get(uniqueRouteId);
        if (conflict) {
          throw new Error(
            `Path ${JSON.stringify(fullPath)} defined by route ${JSON.stringify(
              childRoute.id
            )} conflicts with route ${JSON.stringify(conflict)}`
          );
        } else {
          uniqueRoutes.set(uniqueRouteId, childRoute.id);
        }
      }
      if (index) {
        let invalidChildRoutes = Object.values(routeMap).filter(
          (routeInfo) => routeInfo.parentId === childRoute.id
        );

        if (invalidChildRoutes.length > 0) {
          throw new Error(
            `Child routes are not allowed in index routes. Please remove child routes of ${childRoute.id}`
          );
        }

        defineRoute(routePath, routeMap.get(childRoute.id!)!.file, {
          index: true,
        });
      } else {
        defineRoute(routePath, routeMap.get(childRoute.id!)!.file, () => {
          defineNestedRoutes(defineRoute, childRoute.id);
        });
      }
    }
  }

  let routes = defineRoutes(defineNestedRoutes);

  Object.values(routes).forEach((route) => {
    if (route.parentId === undefined) {
      route.parentId = "root";
    }
  });

  return routes;
}

function isIndexRoute(routeId: string) {
  return routeId.endsWith("_index");
}

type SubState = "NORMAL" | "ESCAPE" | "OPTIONAL" | "OPTIONAL_ESCAPE";

export function getRouteSegments(routeId: string) {
  let routeSegments: string[] = [];
  let index = 0;
  let routeSegment = "";
  let state: "START" | "PATH" = "START";
  let subState: SubState = "NORMAL";
  let pushRouteSegment = (routeSegment: string) => {
    if (routeSegment) {
      if (routeSegment.includes("/")) {
        throw new Error(
          `Route segment cannot contain a slash: ${routeSegment} (in route ${routeId})`
        );
      }
      routeSegments.push(routeSegment);
    }
  };

  while (index < routeId.length) {
    let char = routeId[index];
    index++; //advance to next char

    if (state == "START") {
      // process existing segment
      pushRouteSegment(routeSegment);
      routeSegment = "";
      state = "PATH";
      subState = "NORMAL";
    }
    if (state == "PATH") {
      switch (subState) {
        case "NORMAL": {
          if (isSegmentSeparator(char)) {
            state = "START";
            break;
          }
          if (char === escapeStart) {
            subState = "ESCAPE";
            break;
          }
          if (char === optionalStart) {
            subState = "OPTIONAL";
            break;
          }
          if (!routeSegment && char == paramPrefixChar) {
            if (index === routeId.length) {
              routeSegment += "*";
            } else {
              routeSegment += ":";
            }
            break;
          }
          routeSegment += char;
          break;
        }
        case "ESCAPE": {
          if (char === escapeEnd) {
            subState = "NORMAL";
            break;
          }
          routeSegment += char;
          break;
        }
        case "OPTIONAL": {
          if (char === optionalEnd) {
            routeSegment += "?";
            subState = "NORMAL";
            break;
          }

          if (char === escapeStart) {
            subState = "OPTIONAL_ESCAPE";
            break;
          }

          if (!routeSegment && char === paramPrefixChar) {
            if (index === routeId.length) {
              routeSegment += "*";
            } else {
              routeSegment += ":";
            }
            break;
          }

          routeSegment += char;
          break;
        }
        case "OPTIONAL_ESCAPE": {
          if (char === escapeEnd) {
            subState = "OPTIONAL";
            break;
          }
          routeSegment += char;
          break;
        }
      }
    }
  }

  // process remaining segment
  pushRouteSegment(routeSegment);
  return routeSegments;
}

function findParentRouteId(
  routeInfo: RouteInfo,
  nameMap: Map<string, RouteInfo>
) {
  let parentName = routeInfo.segments.slice(0, -1).join("/");
  while (parentName) {
    let parentRoute = nameMap.get(parentName);
    if (parentRoute) return parentRoute.id;
    parentName = parentName.substring(0, parentName.lastIndexOf("/"));
  }
  return undefined;
}

function getRouteInfo(
  appDirectory: string,
  routeDirectory: string,
  filePath: string
): RouteInfo {
  let filePathWithoutApp = filePath.slice(appDirectory.length + 1);
  let routeId = createRouteId(filePathWithoutApp);
  let routeIdWithoutRoutes = routeId.slice(routeDirectory.length + 1);
  let index = isIndexRoute(routeIdWithoutRoutes);
  let routeSegments = getRouteSegments(routeIdWithoutRoutes);
  let routePath = createRoutePath(routeSegments);

  return {
    id: routeIdWithoutRoutes,
    path: routePath,
    file: filePathWithoutApp,
    name: routeSegments.join("/"),
    segments: routeSegments,
    index,
  };
}

export function createRoutePath(routeSegments: string[]) {
  let result = "";

  for (let segment of routeSegments) {
    // skip pathless layout segments
    if (segment.startsWith("_")) {
      continue;
    }

    // remove trailing slash
    if (segment.endsWith("_")) {
      segment = segment.slice(0, -1);
    }

    result += `/${segment}`;
  }

  return result || undefined;
}
