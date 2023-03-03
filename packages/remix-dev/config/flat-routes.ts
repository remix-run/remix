import fs from "node:fs";
import path from "node:path";
import globToRegex from "glob-to-regexp";

import type { ConfigRoute, RouteManifest } from "./routes";
import { findConfig } from "../config";
import {
  escapeEnd,
  escapeStart,
  isSegmentSeparator,
  optionalEnd,
  optionalStart,
  paramPrefixChar,
  routeModuleExts,
} from "./routesConvention";

const PrefixLookupTrieEndSymbol = Symbol("PrefixLookupTrieEndSymbol");
type PrefixLookupNode = {
  [key: string]: PrefixLookupNode;
} & Record<typeof PrefixLookupTrieEndSymbol, boolean>;

class PrefixLookupTrie {
  root: PrefixLookupNode = {
    [PrefixLookupTrieEndSymbol]: false,
  };

  add(value: string) {
    if (!value) throw new Error("Cannot add empty string to PrefixLookupTrie");

    let node = this.root;
    for (let char of value) {
      if (!node[char]) {
        node[char] = {
          [PrefixLookupTrieEndSymbol]: false,
        };
      }
      node = node[char];
    }
    node[PrefixLookupTrieEndSymbol] = true;
  }

  findAndRemove(prefix: string): string[] {
    let node = this.root;
    for (let char of prefix) {
      if (!node[char]) return [];
      node = node[char];
    }

    return this.#findAndRemoveRecursive([], node, prefix);
  }

  #findAndRemoveRecursive(
    values: string[],
    node: PrefixLookupNode,
    prefix: string
  ): string[] {
    for (let char of Object.keys(node)) {
      this.#findAndRemoveRecursive(values, node[char], prefix + char);
    }

    if (node[PrefixLookupTrieEndSymbol]) {
      node[PrefixLookupTrieEndSymbol] = false;
      values.push(prefix);
    }

    return values;
  }
}

export function flatRoutes(
  appDirectory: string,
  ignoredFilePatterns?: string[],
  prefix = "routes"
) {
  let ignoredFileRegex = (ignoredFilePatterns || []).map((pattern) =>
    globToRegex(pattern)
  );
  let routesDir = path.join(appDirectory, prefix);
  let routeManifest: RouteManifest = {};

  let rootRoute = findConfig(appDirectory, "root", routeModuleExts);

  if (!rootRoute) {
    throw new Error(
      `Could not find a root route module in the routes directory: ${routesDir}`
    );
  }

  if (fs.existsSync(routesDir)) {
    // Only read the routes directory
    let entries = fs.readdirSync(routesDir, {
      withFileTypes: true,
      encoding: "utf-8",
    });

    let routes: string[] = [];
    for (let entry of entries) {
      let filepath: string | undefined = path.join(routesDir, entry.name);

      let route: string | null = null;
      // If it's a directory, don't recurse into it, instead just look for a route module
      if (entry.isDirectory()) {
        route = findRouteModuleForFolder(
          appDirectory,
          filepath,
          ignoredFileRegex
        );
      } else if (entry.isFile()) {
        route = findRouteModuleForFile(filepath, ignoredFileRegex);
      }

      if (route) routes.push(route);
    }

    routeManifest = flatRoutesUniversal(appDirectory, routes, prefix);
  } else {
    throw new Error(
      `Could not find the routes directory: ${routesDir}. Did you forget to create it?`
    );
  }

  return routeManifest;
}

export function flatRoutesUniversal(
  appDirectory: string,
  routes: string[],
  prefix: string = "routes"
): RouteManifest {
  let conflicts = new Map<string, string[]>();
  let routesDirectory = path.join(appDirectory, prefix);
  let routeManifest: RouteManifest = {};
  let prefixLookup = new PrefixLookupTrie();
  routes.sort((a, b) => b.length - a.length);

  let uniqueRouteIds = new Map<string, ConfigRoute>();

  for (let file of routes) {
    let routeExt = path.extname(file);
    let routeDir = path.dirname(file);
    let routeId =
      routeDir === routesDirectory
        ? path.relative(appDirectory, file).slice(0, -routeExt.length)
        : path.relative(appDirectory, routeDir);

    let routeIdWithoutPrefix = routeId.slice(prefix.length + 1);

    let index = routeId.endsWith("_index");
    let [segments, raw] = getRouteSegments(routeIdWithoutPrefix);
    let routePath = createRoutePath(segments, raw, index);

    let route: ConfigRoute = {
      file: file.slice(appDirectory.length + 1),
      id: routeId,
      path: routePath,
      parentId: "root",
    };
    if (index) route.index = true;

    let conflict = uniqueRouteIds.get(route.id || "/");

    // collect conflicts for later reporting
    if (conflict) {
      console.log({
        route: route.file,
        conflict: conflict.file,
      });
      let currentConflicts = conflicts.get(route.path || "/");
      if (!currentConflicts) {
        conflicts.set(route.path || "/", [conflict.file, route.file]);
      } else {
        currentConflicts.push(route.file);
        conflicts.set(route.path || "/", currentConflicts);
      }

      continue;
    }

    routeManifest[file] = route;
    uniqueRouteIds.set(route.id || "/", route);

    let childRoutes = prefixLookup.findAndRemove(routeId);
    prefixLookup.add(routeId);

    if (childRoutes.length > 0) {
      for (let fullChildRouteId of childRoutes) {
        let childRouteId = fullChildRouteId.slice(routeId.length + 1);
        let childRouteFile = path.join(
          appDirectory,
          fullChildRouteId + routeExt
        );
        let index = fullChildRouteId.endsWith("_index");
        let [segments, raw] = getRouteSegments(childRouteId);
        let routePath = createRoutePath(segments, raw, index);

        let childRoute: ConfigRoute = {
          file: childRouteFile.slice(appDirectory.length + 1),
          id: childRouteId,
          parentId: routeId,
          path: routePath,
        };

        if (index) childRoute.index = true;

        let conflict = uniqueRouteIds.get(childRoute.id || "/");

        // collect conflicts for later reporting
        if (conflict) {
          let currentConflicts = conflicts.get(childRoute.path || "/");
          if (!currentConflicts) {
            conflicts.set(childRoute.path || "/", [
              conflict.file,
              childRoute.file,
            ]);
          } else {
            currentConflicts.push(childRoute.file);
            conflicts.set(childRoute.path || "/", currentConflicts);
          }

          continue;
        }

        uniqueRouteIds.set(childRoute.id || "/", childRoute);
        routeManifest[childRouteFile] = childRoute;
      }
    }
  }

  // report conflicts
  if (conflicts.size > 0) {
    for (let [path, files] of conflicts.entries()) {
      console.error(getRouteConflictErrorMessage(path, files));
    }
  }

  return routeManifest;
}

function findRouteModuleForFile(
  filepath: string,
  ignoredFileRegex: RegExp[]
): string | null {
  let isIgnored = ignoredFileRegex.some((regex) => regex.test(filepath));
  if (isIgnored) return null;
  return filepath;
}

function findRouteModuleForFolder(
  appDirectory: string,
  filepath: string,
  ignoredFileRegex: RegExp[]
): string | null {
  let isIgnored = ignoredFileRegex.some((regex) => regex.test(filepath));
  if (isIgnored) return null;

  let routeIndexModule = findConfig(filepath, "index", routeModuleExts);
  let routeRouteModule = findConfig(filepath, "route", routeModuleExts);

  if (routeIndexModule && routeRouteModule) {
    let [segments, raw] = getRouteSegments(
      path.relative(appDirectory, filepath)
    );
    let routePath = createRoutePath(segments, raw, false);
    console.error(
      getRouteConflictErrorMessage(routePath || "/", [
        path.relative(appDirectory, routeIndexModule),
        path.relative(appDirectory, routeRouteModule),
      ])
    );
  }

  return routeRouteModule || routeIndexModule || null;
}

type State =
  | // normal path segment normal character concatenation until we hit a special character or the end of the segment (i.e. `/`, `.`, '\')
  "NORMAL"
  // we hit a `[` and are now in an escape sequence until we hit a `]` - take characters literally and skip isSegmentSeparator checks
  | "ESCAPE"
  // we hit a `(` and are now in an optional segment until we hit a `)` or an escape sequence
  | "OPTIONAL"
  // we previously were in a opt fional segment and hit a `[` and are now in an escape sequence until we hit a `]` - take characters literally and skip isSegmentSeparator checks - afterwards go back to OPTIONAL state
  | "OPTIONAL_ESCAPE";

export function getRouteSegments(routeId: string): [string[], string[]] {
  let routeSegments: string[] = [];
  let rawRouteSegments: string[] = [];
  let index = 0;
  let routeSegment = "";
  let rawRouteSegment = "";
  let state: State = "NORMAL";

  let pushRouteSegment = (segment: string, rawSegment: string) => {
    if (!segment) return;

    let notSupportedInRR = (segment: string, char: string) => {
      throw new Error(
        `Route segment "${segment}" for "${routeId}" cannot contain "${char}".\n` +
          `If this is something you need, upvote this proposal for React Router https://github.com/remix-run/react-router/discussions/9822.`
      );
    };

    if (rawSegment.includes("*")) {
      return notSupportedInRR(rawSegment, "*");
    }

    if (rawSegment.includes(":")) {
      return notSupportedInRR(rawSegment, ":");
    }

    if (rawSegment.includes("/")) {
      return notSupportedInRR(segment, "/");
    }

    routeSegments.push(segment);
    rawRouteSegments.push(rawSegment);
  };

  while (index < routeId.length) {
    let char = routeId[index];
    index++; //advance to next char

    switch (state) {
      case "NORMAL": {
        if (isSegmentSeparator(char)) {
          pushRouteSegment(routeSegment, rawRouteSegment);
          routeSegment = "";
          rawRouteSegment = "";
          state = "NORMAL";
          break;
        }
        if (char === escapeStart) {
          state = "ESCAPE";
          rawRouteSegment += char;
          break;
        }
        if (char === optionalStart) {
          state = "OPTIONAL";
          rawRouteSegment += char;
          break;
        }
        if (!routeSegment && char == paramPrefixChar) {
          if (index === routeId.length) {
            routeSegment += "*";
            rawRouteSegment += char;
          } else {
            routeSegment += ":";
            rawRouteSegment += char;
          }
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
      case "ESCAPE": {
        if (char === escapeEnd) {
          state = "NORMAL";
          rawRouteSegment += char;
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
      case "OPTIONAL": {
        if (char === optionalEnd) {
          routeSegment += "?";
          rawRouteSegment += char;
          state = "NORMAL";
          break;
        }

        if (char === escapeStart) {
          state = "OPTIONAL_ESCAPE";
          rawRouteSegment += char;
          break;
        }

        if (!routeSegment && char === paramPrefixChar) {
          if (index === routeId.length) {
            routeSegment += "*";
            rawRouteSegment += char;
          } else {
            routeSegment += ":";
            rawRouteSegment += char;
          }
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
      case "OPTIONAL_ESCAPE": {
        if (char === escapeEnd) {
          state = "OPTIONAL";
          rawRouteSegment += char;
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
    }
  }

  // process remaining segment
  pushRouteSegment(routeSegment, rawRouteSegment);
  return [routeSegments, rawRouteSegments];
}

export function createRoutePath(
  routeSegments: string[],
  rawRouteSegments: string[],
  isIndex: boolean
) {
  let result: string[] = [];

  if (isIndex) {
    routeSegments = routeSegments.slice(0, -1);
  }

  for (let index = 0; index < routeSegments.length; index++) {
    let segment = routeSegments[index];
    let rawSegment = rawRouteSegments[index];

    // skip pathless layout segments
    if (segment.startsWith("_") && rawSegment.startsWith("_")) {
      continue;
    }

    // remove trailing slash
    if (segment.endsWith("_") && rawSegment.endsWith("_")) {
      segment = segment.slice(0, -1);
    }

    result.push(segment);
  }

  return result ? result.join("/") : undefined;
}

export function getRouteConflictErrorMessage(
  pathname: string,
  routes: string[]
) {
  let [taken, ...others] = routes;

  let pathnameWithLeadingSlash = pathname.startsWith("/")
    ? pathname
    : "/" + pathname;

  return (
    `⚠️ Route Path Collision: "${pathnameWithLeadingSlash}"\n\n` +
    `The following routes all define the same URL, only the first one will be used\n\n` +
    `🟢 ${taken}\n` +
    others.map((route) => `⭕️️ ${route}`).join("\n") +
    "\n"
  );
}
