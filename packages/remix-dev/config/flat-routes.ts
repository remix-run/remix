import * as fs from "fs";
import * as path from "path";
import minimatch from "minimatch";

import { createRouteId, defineRoutes } from "./routes";
import type { RouteManifest, DefineRouteFunction } from "./routes";
import {
  escapeEnd,
  escapeStart,
  isRouteModuleFile,
  optionalEnd,
  optionalStart,
  paramPrefixChar,
} from "./routesConvention";

type RouteInfo = {
  id: string;
  path: string;
  file: string;
  name: string;
  segments: string[];
  parentId?: string;
  index?: boolean;
  caseSensitive?: boolean;
};

export type FlatRoutesOptions = {
  routeRegex?: RegExp;
};

export function flatRoutes(
  appDir: string,
  ignoredFilePatterns?: string[]
): RouteManifest {
  let routeMap: Map<string, RouteInfo> = new Map();
  let nameMap: Map<string, RouteInfo> = new Map();

  visitFiles(path.join(appDir, "routes"), (file) => {
    if (
      ignoredFilePatterns &&
      ignoredFilePatterns.some((pattern) =>
        minimatch(file, pattern, { dot: true })
      )
    ) {
      return;
    }

    if (isRouteModuleFile(file)) {
      let routeInfo = getRouteInfo("routes", file);
      routeMap.set(routeInfo.id, routeInfo);
      nameMap.set(routeInfo.name, routeInfo);
      return;
    }
  });

  // update parentIds for all routes
  for (let routeInfo of routeMap.values()) {
    let parentId = findParentRouteId(routeInfo, nameMap);
    routeInfo.parentId = parentId;
  }

  let uniqueRoutes = new Map<string, string>();

  // Then, recurse through all routes using the public defineRoutes() API
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
      let uniqueRouteId = (fullPath || "") + (index ? "?index" : "");

      if (uniqueRouteId) {
        if (uniqueRoutes.has(uniqueRouteId)) {
          throw new Error(
            `Path ${JSON.stringify(fullPath)} defined by route ${JSON.stringify(
              childRoute.id
            )} conflicts with route ${JSON.stringify(
              uniqueRoutes.get(uniqueRouteId)
            )}`
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
  return routes;
}

const indexRouteRegex = /((^|[.])(_index))(\/[^/]+)?$|(\/_?index\/)/;
export function isIndexRoute(routeId: string): boolean {
  return indexRouteRegex.test(routeId);
}

export function getRouteInfo(routeDir: string, file: string) {
  let filePath = path.join(routeDir, file);
  let routeId = createRouteId(filePath);
  let routeIdWithoutRoutes = routeId.slice(routeDir.length + 1);
  let index = isIndexRoute(routeIdWithoutRoutes);
  let routeSegments = getRouteSegments(routeIdWithoutRoutes);
  let routePath = createRoutePath(routeSegments, index);
  let routeInfo = {
    id: routeId,
    path: routePath!,
    file: filePath,
    name: routeSegments.join("/"),
    segments: routeSegments,
    index,
  };

  return routeInfo;
}

function handleEscapedSegment(segment: string) {
  let matches = segment.match(/\[(.*?)\]/g);

  if (!matches) return segment;

  for (let match of matches) {
    segment = segment.replace(match, match.slice(1, -1));
  }

  return segment;
}

function handleSplatOrParamSegment(segment: string) {
  console.log("handleSplatOrParam", segment);

  if (segment.startsWith(paramPrefixChar)) {
    if (segment === "$?") return segment;
    if (segment === paramPrefixChar) {
      return "*";
    }

    return `:${segment.slice(1)}`;
  }

  return segment;
}

function handleOptionalSegment(segment: string) {
  let optional = segment.slice(1, -1);

  if (optional.startsWith(paramPrefixChar)) {
    return `:${optional.slice(1)}?`;
  }

  return optional + "?";
}

// create full path starting with /
export function createRoutePath(
  routeSegments: string[],
  index: boolean
): string | undefined {
  let result = "";

  if (index) {
    // remove index segment
    routeSegments = routeSegments.slice(0, -1);
  }

  for (let segment of routeSegments) {
    // skip pathless layout segments
    if (segment.startsWith("_")) {
      continue;
    }

    // remove trailing slash
    if (segment.endsWith("_")) {
      segment = segment.slice(0, -1);
    }

    // handle optional segments: `(segment)` => `segment?`
    if (segment.startsWith(optionalStart) && segment.endsWith(optionalEnd)) {
      let escaped = handleEscapedSegment(segment);
      let optional = handleOptionalSegment(escaped);
      let param = handleSplatOrParamSegment(optional);
      result += `/${param}`;
    }

    // handle escape segments: `[se[g]ment]` => `segment`
    else if (segment.includes(escapeStart) && segment.includes(escapeEnd)) {
      let escaped = handleEscapedSegment(segment);
      let param = handleSplatOrParamSegment(escaped);
      result += `/${param}`;
    }

    // handle param segments: `$` => `*`, `$id` => `:id`
    else if (segment.startsWith(paramPrefixChar)) {
      result += `/${handleSplatOrParamSegment(segment)}`;
    } else {
      result += `/${segment}`;
    }
  }

  return result || undefined;
}

function findParentRouteId(
  routeInfo: RouteInfo,
  nameMap: Map<string, RouteInfo>
): string | undefined {
  let parentName = routeInfo.segments.slice(0, -1).join("/");
  while (parentName) {
    if (nameMap.has(parentName)) {
      return nameMap.get(parentName)!.id;
    }
    parentName = parentName.substring(0, parentName.lastIndexOf("/"));
  }
  return undefined;
}

export function getRouteSegments(name: string) {
  let routeSegments: string[] = [];
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
    switch (state) {
      case "START":
        pushRouteSegment(routeSegment);
        routeSegment = "";
        state = "PATH";
        continue; // restart without advancing index
      case "PATH":
        if (isPathSeparator(char) && subState === "NORMAL") {
          state = "START";
          break;
        } else if (char === optionalStart) {
          routeSegment += char;
          subState = "OPTIONAL";
          break;
        } else if (char === optionalEnd) {
          routeSegment += char;
          subState = "NORMAL";
          break;
        } else if (char === escapeStart) {
          routeSegment += char;
          subState = "ESCAPE";
          break;
        } else if (char === escapeEnd) {
          routeSegment += char;
          subState = "NORMAL";
          break;
        }
        routeSegment += char;
        break;
    }
    index++; // advance to next character
  }

  // process remaining segment
  pushRouteSegment(routeSegment);

  return routeSegments;
}

const pathSeparatorRegex = /[/\\.]/;
function isPathSeparator(char: string) {
  return pathSeparatorRegex.test(char);
}

export function visitFiles(
  dir: string,
  visitor: (file: string) => void,
  baseDir = dir
) {
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
