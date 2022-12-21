import type { ConfigRoute } from "./routes";

/**
 * Create route configs from a list of routes using the flat routes conventions.
 * @param {string} appDirectory The absolute root directory the routes were looked up from.
 * @param {string[]} routePaths The absolute route paths.
 * @param {string} [prefix = "routes"] The prefix to strip off of the routes.
 */
export function flatRoutesUniversal(
  appDirectory: string,
  routePaths: string[],
  prefix: string = "routes"
) {
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

    let parentId = "";
    for (let processedId of processedIds) {
      if (routeId.startsWith(processedId.replace(/\$$/, "*"))) {
        parentId = processedId;
        break;
      }
    }

    routes[routeId] = {
      id: routeId,
      path: pathFromRouteId(routeId, parentId || prefix),
      parentId: parentId || "root",
      file: routePath,
    };
    if (isIndexRoute(routeId)) {
      routes[routeId].index = true;
    }
    processedIds.unshift(routeId);
  }
  return Object.values(routes);
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
export function pathFromRouteId(routeId: string, parentId: string) {
  let parentPath = "";
  if (parentId) {
    parentPath = getRouteSegments(parentId, true)[0].join("/");
  }
  if (parentPath.startsWith("/")) {
    parentPath = parentPath.substring(1);
  }
  let routePath = getRouteSegments(routeId, true)[0].join("/");
  if (routePath.startsWith("/")) {
    routePath = routePath.substring(1);
  }
  let pathname = parentPath
    ? routePath.slice(parentPath.length + 1)
    : routePath;
  if (pathname.endsWith("index") || pathname.endsWith("/_index")) {
    pathname = pathname.replace(/index$/, "");
  }
  if (pathname.startsWith("/")) {
    pathname = pathname.substring(1);
  }
  return pathname || undefined;
}

function isIndexRoute(routeId: string) {
  return routeId.endsWith("index");
}

// TODO: Add support for optional segments
function getRouteSegments(name: string, toPath: boolean = true) {
  let routeSegments: string[] = [];
  let separators: string[] = [];
  let index = 0;
  let routeSegment = "";
  let state = "START";
  let subState = "NORMAL";
  let pushRouteSegment = (routeSegment: string) => {
    if (routeSegment) {
      routeSegments.push(routeSegment);
    }
  };
  while (index < name.length) {
    let char = name[index];
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
        case "PATHLESS":
          if (isPathSeparator(char)) {
            state = "START";
            break;
          }
          break;
        case "NORMAL":
          if (isPathSeparator(char)) {
            state = "START";
            separators.push(char);
            break;
          }
          if (toPath && char === "[") {
            subState = "ESCAPE";
            break;
          }
          if (toPath && !routeSegment && char == "$") {
            if (index === name.length) {
              routeSegment += "*";
            } else {
              routeSegment += ":";
            }
            break;
          }
          routeSegment += char;
          break;
        case "ESCAPE":
          if (
            toPath &&
            char === "]" &&
            name[index - 1] !== "[" &&
            name[index + 1] !== "]"
          ) {
            subState = "NORMAL";
            break;
          }
          routeSegment += char;
          break;
      }
    }
  }
  // process remaining segment
  pushRouteSegment(routeSegment);
  return [routeSegments, separators];
}

function isPathSeparator(char: string | undefined) {
  return char === "/" || char === ".";
}
