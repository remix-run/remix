import * as fs from "fs";
import * as path from "path";
import minimatch from "minimatch";

import type { RouteManifest, DefineRouteFunction } from "./routes";
import { defineRoutes, createRouteId } from "./routes";

export const routeModuleExts = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".md",
  ".mdx",
]);

export function isRouteModuleFile(filename: string): boolean {
  return routeModuleExts.has(path.extname(filename));
}

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
export function defineConventionalRoutes(
  appDir: string,
  ignoredFilePatterns?: string[]
): RouteManifest {
  let files: { [routeId: string]: string } = {};

  // First, find all route modules in app/routes
  visitFiles(path.join(appDir, "routes"), (file) => {
    if (
      ignoredFilePatterns &&
      ignoredFilePatterns.some((pattern) => minimatch(file, pattern))
    ) {
      return;
    }

    if (isRouteModuleFile(file)) {
      let routeId = createRouteId(path.join("routes", file));
      files[routeId] = path.join("routes", file);
      return;
    }

    throw new Error(
      `Invalid route module file: ${path.join(appDir, "routes", file)}`
    );
  });

  let routeIds = Object.keys(files).sort(byLongestFirst);
  let parentRouteIds = getParentRouteIds(routeIds);

  let uniqueRoutes = new Map<string, string>();

  // Then, recurse through all routes using the public defineRoutes() API
  function defineNestedRoutes(
    defineRoute: DefineRouteFunction,
    parentId?: string
  ): void {
    let childRouteIds = routeIds.filter(
      (id) => parentRouteIds[id] === parentId
    );

    for (let routeId of childRouteIds) {
      let routePath: string | undefined = createRoutePath(
        routeId.slice((parentId || "routes").length + 1)
      );

      let isIndexRoute = routeId.endsWith("/index");
      let fullPath = createRoutePath(routeId.slice("routes".length + 1));
      let uniqueRouteId = (fullPath || "") + (isIndexRoute ? "?index" : "");

      if (uniqueRouteId) {
        if (uniqueRoutes.has(uniqueRouteId)) {
          throw new Error(
            `Path ${JSON.stringify(fullPath)} defined by route ${JSON.stringify(
              routeId
            )} conflicts with route ${JSON.stringify(
              uniqueRoutes.get(uniqueRouteId)
            )}`
          );
        } else {
          uniqueRoutes.set(uniqueRouteId, routeId);
        }
      }

      if (isIndexRoute) {
        let invalidChildRoutes = routeIds.filter(
          (id) => parentRouteIds[id] === routeId
        );

        if (invalidChildRoutes.length > 0) {
          throw new Error(
            `Child routes are not allowed in index routes. Please remove child routes of ${routeId}`
          );
        }

        defineRoute(routePath, files[routeId], {
          index: true,
        });
      } else {
        defineRoute(routePath, files[routeId], () => {
          defineNestedRoutes(defineRoute, routeId);
        });
      }
    }
  }

  return defineRoutes(defineNestedRoutes);
}

export let paramPrefixChar = "$" as const;
export let escapeStart = "[" as const;
export let escapeEnd = "]" as const;

export let optionalStart = "(" as const;
export let optionalEnd = ")" as const;

// TODO: Cleanup and write some tests for this function
export function createRoutePath(partialRouteId: string): string | undefined {
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
      if (rawSegmentBuffer === "index" && result.endsWith("index")) {
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
    if (char === "_" && nextChar === "_" && !rawSegmentBuffer) {
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

  if (rawSegmentBuffer === "index" && result.endsWith("index")) {
    result = result.replace(/\/?index$/, "");
  }

  if (rawSegmentBuffer === "index" && result.endsWith("index?")) {
    throw new Error(
      `Invalid route path: ${partialRouteId}. Make index route optional by using (index)`
    );
  }

  return result || undefined;
}

function isNewEscapeSequence(
  inEscapeSequence: number,
  char: string,
  prevChar: string | undefined
) {
  return !inEscapeSequence && char === escapeStart && prevChar !== escapeStart;
}

function isCloseEscapeSequence(
  inEscapeSequence: number,
  char: string,
  nextChar: string | undefined
) {
  return inEscapeSequence && char === escapeEnd && nextChar !== escapeEnd;
}

export function isSegmentSeparator(checkChar: string | undefined) {
  if (!checkChar) return false;
  return ["/", ".", path.win32.sep].includes(checkChar);
}

function isNewOptionalSegment(
  char: string,
  prevChar: string | undefined,
  inOptionalSegment: number,
  inEscapeSequence: number
) {
  return (
    char === optionalStart &&
    prevChar !== optionalStart &&
    (isSegmentSeparator(prevChar) || prevChar === undefined) &&
    !inOptionalSegment &&
    !inEscapeSequence
  );
}

function isCloseOptionalSegment(
  char: string,
  nextChar: string | undefined,
  inOptionalSegment: number,
  inEscapeSequence: number
) {
  return (
    char === optionalEnd &&
    nextChar !== optionalEnd &&
    (isSegmentSeparator(nextChar) || nextChar === undefined) &&
    inOptionalSegment &&
    !inEscapeSequence
  );
}

function getParentRouteIds(
  routeIds: string[]
): Record<string, string | undefined> {
  return routeIds.reduce<Record<string, string | undefined>>(
    (parentRouteIds, childRouteId) => ({
      ...parentRouteIds,
      [childRouteId]: routeIds.find((id) => childRouteId.startsWith(`${id}/`)),
    }),
    {}
  );
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
