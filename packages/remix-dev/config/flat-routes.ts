import * as fs from "fs";
import * as path from "path";
import minimatch from "minimatch";

import { createRouteId, defineRoutes } from "./routes";
import type { RouteManifest, DefineRouteFunction } from "./routes";
import {
  isCloseEscapeSequence,
  isCloseOptionalSegment,
  isNewEscapeSequence,
  isNewOptionalSegment,
  isRouteModuleFile,
  isSegmentSeparator,
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

// create full path starting with /
export function createRoutePath(
  routeSegments: string[],
  index: boolean
): string | undefined {
  if (index) {
    // remove index segment
    routeSegments = routeSegments.slice(0, -1);
  }

  let normalized = routeSegments.filter((s) => s !== "");

  return normalized.length > 0 ? "/" + normalized.join("/") : undefined;
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

export function getRouteSegments(partialRouteId: string) {
  let result = "";
  let rawSegmentBuffer = "";

  let inEscapeSequence = 0;
  let inOptionalSegment = 0;
  let optionalSegmentIndex = null;
  let skipSegment = false;
  for (let i = 0; i < partialRouteId.length; i++) {
    let char = partialRouteId.charAt(i);
    let prevChar = i > 0 ? partialRouteId.charAt(i - 1) : undefined;
    let nextChar =
      i < partialRouteId.length - 1 ? partialRouteId.charAt(i + 1) : undefined;

    if (skipSegment) {
      if (isSegmentSeparator(char)) {
        skipSegment = false;
      }
      continue;
    }

    if (isNewEscapeSequence(inEscapeSequence, char, prevChar)) {
      inEscapeSequence++;
      continue;
    }

    if (isCloseEscapeSequence(inEscapeSequence, char, nextChar)) {
      inEscapeSequence--;
      continue;
    }

    if (
      isNewOptionalSegment(char, prevChar, inOptionalSegment, inEscapeSequence)
    ) {
      inOptionalSegment++;
      optionalSegmentIndex = result.length;
      result += optionalStart;
      continue;
    }

    if (
      isCloseOptionalSegment(
        char,
        nextChar,
        inOptionalSegment,
        inEscapeSequence
      )
    ) {
      if (optionalSegmentIndex !== null) {
        result =
          result.slice(0, optionalSegmentIndex) +
          result.slice(optionalSegmentIndex + 1);
      }
      optionalSegmentIndex = null;
      inOptionalSegment--;
      result += "?";
      continue;
    }

    if (inEscapeSequence) {
      result += char;
      continue;
    }

    if (isSegmentSeparator(char)) {
      // url segment, no layout
      if (prevChar === "_") {
        result = result.slice(0, -1);
      }

      if (rawSegmentBuffer === "_index" && result.endsWith("_index")) {
        result = result.replace(/\/?index$/, "");
      } else {
        result += "/";
      }

      rawSegmentBuffer = "";
      inOptionalSegment = 0;
      optionalSegmentIndex = null;
      continue;
    }

    // isStartOfLayoutSegment
    // layout nesting, no url segment
    if (char === "_" && !rawSegmentBuffer) {
      skipSegment = true;
      continue;
    }

    rawSegmentBuffer += char;

    if (char === paramPrefixChar) {
      if (nextChar === optionalEnd) {
        throw new Error(
          `Invalid route path: ${partialRouteId}. Splat route $ is already optional`
        );
      }
      result += typeof nextChar === "undefined" ? "*" : ":";
      continue;
    }

    result += char;
  }

  if (rawSegmentBuffer === "_index" && result.endsWith("_index")) {
    result = result.replace(/\/?index$/, "");
  }

  if (rawSegmentBuffer === "_index" && result.endsWith("_index?")) {
    throw new Error(
      `Invalid route path: ${partialRouteId}. Make index route optional by using (_index)`
    );
  }

  return result ? result.split("/") : [];
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
