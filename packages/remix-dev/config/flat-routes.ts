import path from "node:path";
import fg from "fast-glob";

import type { ConfigRoute, RouteManifest } from "./routes";
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
  let routes: Record<string, ConfigRoute> = {};
  let sortedRoutes = routePaths
    .sort((a, b) => (a.length - b.length > 0 ? 1 : -1))
    .map((routePath) =>
      routePath.slice(appDirectory.length + 1).replace(/\\/g, "/")
    );
  let processedIds: string[] = [];
  for (let routePath of sortedRoutes) {
    let routeId = routeIdFromPath(routePath);
    if (routes[routeId]) {
      throw new Error(`Duplicate route: ${routeId}`);
    }

    let tmpId = "";
    let parentId = "";
    for (let processedId of processedIds) {
      if (routeId.startsWith(processedId.replace(/\$$/, "*"))) {
        let [segments, delimiters] = splitBySegments(routeId);
        if (segments.at(1)?.endsWith("_")) {
          segments[1] = segments[1].slice(0, -1);
          tmpId = segments.map((s, i) => s + delimiters[i]).join("");
          break;
        }

        parentId = processedId;
        break;
      }
    }

    routes[routeId] = {
      id: routeId,
      path: pathFromRouteId(tmpId || routeId, parentId || prefix),
      parentId: parentId || "root",
      file: routePath,
    };
    if (isIndexRoute(routeId)) {
      routes[routeId].index = true;
    }
    processedIds.unshift(routeId);
  }

  return routes;
}

function routeIdFromPath(relativePath: string) {
  return (
    relativePath
      .split(".")
      // remove file extension
      .slice(0, -1)
      .join(".")
  );
}

function pathFromRouteId(routeId: string, parentId: string) {
  let parentPath = "";
  if (parentId) {
    parentPath = getRouteSegments(parentId).join("/");
  }
  if (parentPath.startsWith("/")) {
    parentPath = parentPath.substring(1);
  }
  let routePath = getRouteSegments(routeId).join("/");
  if (routePath.startsWith("/")) {
    routePath = routePath.substring(1);
  }
  let pathname = parentPath
    ? routePath.slice(parentPath.length + 1)
    : routePath;
  if (pathname.endsWith("/_index")) {
    pathname = pathname.replace(/_index$/, "");
  }
  if (pathname.startsWith("/")) {
    pathname = pathname.substring(1);
  }
  return pathname || undefined;
}

function isIndexRoute(routeId: string) {
  return routeId.endsWith("_index");
}

type SubState =
  | "NORMAL"
  | "PATHLESS"
  | "ESCAPE"
  | "OPTIONAL"
  | "OPTIONAL_ESCAPE";

function getRouteSegments(routeId: string) {
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
    index++; // advance to next character
    if (state == "START") {
      // process existing segment
      pushRouteSegment(routeSegment);
      routeSegment = "";
      state = "PATH";
      subState = "NORMAL";
      if (char === "_") {
        subState = "PATHLESS";
      }
    }
    if (state == "PATH") {
      switch (subState) {
        case "PATHLESS": {
          if (isSegmentSeparator(char)) {
            state = "START";
            break;
          }
          break;
        }
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

export function splitBySegments(routeId: string) {
  // split by / and . to get the segments
  let segments = routeId.split(/[/.\\]/);
  let start = 0;
  let delimiters = segments.map((s, i, { [i + 1]: next }) => {
    let index = routeId.indexOf(next, (start += s.length));
    if (index !== -1) {
      let sub = routeId.slice(start, index);
      start = index;
      return sub;
    }
    return "";
  });

  return [segments, delimiters];
}
