import * as fs from "fs";
import * as path from "path";
import minimatch from "minimatch";

import type {
  defineRoutes,
  RouteManifest,
  DefineRouteFunction,
} from "./routes";

type RouteInfo = {
  id: string;
  path: string;
  file: string;
  name: string;
  parentId?: string; // first pass parent is undefined
  index?: boolean;
  caseSensitive?: boolean;
};

type DefineRouteOptions = {
  caseSensitive?: boolean;
  index?: boolean;
};

type DefineRouteChildren = {
  (): void;
};

export type VisitFilesFunction = (
  dir: string,
  visitor: (file: string) => void,
  baseDir?: string
) => void;

type FlatRoutesOptions = {
  basePath?: string;
  visitFiles?: VisitFilesFunction;
  paramPrefixChar?: string;
  ignoredRouteFiles?: string[];
};

type ParentMapEntry = {
  routeInfo: RouteInfo;
  children: RouteInfo[];
};

export type DefineRoutesFunction = typeof defineRoutes;

export function flatRoutes(
  baseDir: string | string[],
  defineRoutes: DefineRoutesFunction,
  options: FlatRoutesOptions = {}
): RouteManifest {
  let routeMap = new Map<string, RouteInfo>();
  let parentMap = new Map<string, ParentMapEntry>();
  let visitor = options?.visitFiles || visitFiles;
  let ignoredFilePatterns = options?.ignoredRouteFiles ?? [];
  // initialize root route
  routeMap.set("root", {
    id: "root",
    path: "",
    file: "root.tsx",
    name: "root",
    parentId: "",
    index: false,
  });
  let baseDirs = Array.isArray(baseDir) ? baseDir : [baseDir];
  let routes: RouteManifest = {};
  for (let baseDir of baseDirs) {
    let baseRoutes = defineRoutes((route) => {
      visitor(`app/${baseDir}`, (routeFile: string) => {
        let file = `app/${baseDir}/${routeFile}`;
        let absoluteFile = path.resolve(file);
        if (isIgnoredRouteFile(absoluteFile, ignoredFilePatterns)) {
          return;
        }

        let routeInfo = getRouteInfo(
          baseDir,
          routeFile,
          options.basePath,
          options.paramPrefixChar
        );
        if (!routeInfo) return;
        routeMap.set(routeInfo.name, routeInfo);
      });
      // setup parent map
      for (let [name, route] of routeMap) {
        if (name === "root") continue;
        let parentRoute = getParentRoute(routeMap, name);
        if (parentRoute) {
          let parent = parentMap.get(parentRoute);
          if (!parent) {
            parent = {
              routeInfo: routeMap.get(parentRoute)!,
              children: [],
            };
            parentMap.set(parentRoute, parent);
          }
          parent.children.push(route);
        }
      }
      // start with root
      getRoutes(parentMap, "root", route);
    });

    routes = { ...routes, ...baseRoutes };
  }
  // don't return root since remix already provides it
  if (routes) {
    delete routes.root;
  }
  // HACK: Update the route ids for index routes to work around
  // a bug in Remix as of v1.7.5. Need this until PR #4560 is merged.
  // https://github.com/remix-run/remix/pull/4560
  let fixedRoutes = fixupIndexRoutes(routes);
  return fixedRoutes;
}

function fixupIndexRoutes(routes: RouteManifest) {
  let oldRoutes = { ...routes };
  // append /index to all index route ids
  Object.entries(oldRoutes).forEach(([id, route]: any) => {
    if (route.index && !id.endsWith("/index")) {
      let newId = id + "/index";
      route.id = newId;
      routes[newId] = route;
      delete routes[id];
    }
  });
  // fixup the parent ids to match the new ids
  Object.entries(routes).forEach(([, route]: any) => {
    if (routes[route.parentId!]?.index) {
      route.parentId = routes[route.parentId!].id;
    }
  });
  return routes;
}

function isIgnoredRouteFile(file: string, ignoredRouteFiles: string[]) {
  return ignoredRouteFiles.some((pattern) =>
    minimatch(file, pattern, { dot: true })
  );
}

function getParentRoute(
  routeMap: Map<string, RouteInfo>,
  name: string
): string | null {
  let parentName = name.substring(0, name.lastIndexOf("."));
  if (parentName === "") {
    return "root";
  }
  if (routeMap.has(parentName)) {
    return parentName;
  }
  return getParentRoute(routeMap, parentName);
}

function getRoutes(
  parentMap: Map<string, ParentMapEntry>,
  parent: string,
  route: DefineRouteFunction
) {
  let parentRoute = parentMap.get(parent);
  if (parentRoute && parentRoute.children) {
    let routeOptions: DefineRouteOptions = {
      caseSensitive: false,
      index: parentRoute!.routeInfo.index,
    };
    let routeChildren: DefineRouteChildren = () => {
      for (let child of parentRoute!.children) {
        getRoutes(parentMap, child.name, route);

        let path = child.path.substring(parentRoute!.routeInfo.path.length);
        if (path.startsWith("/")) path = path.substring(1);
        route(path, child.file, { index: child.index });
      }
    };
    route(
      parentRoute.routeInfo.path,
      parentRoute.routeInfo.file,
      routeOptions,
      routeChildren
    );
  }
}

export function getRouteInfo(
  baseDir: string,
  routeFile: string,
  basePath?: string,
  paramsPrefixChar?: string
): RouteInfo | null {
  let url = basePath ?? "";
  if (url.startsWith("/")) {
    url = url.substring(1);
  }
  // get extension
  let ext = path.extname(routeFile);
  // only process valid route files
  if (![".js", ".jsx", ".ts", ".tsx", ".md", ".mdx"].includes(ext)) {
    return null;
  }
  // remove extension from name and normalize path separators
  let name = routeFile
    .substring(0, routeFile.length - ext.length)
    .replace(path.win32.sep, "/");
  if (name.includes("/")) {
    // route flat-folder so only process index/layout routes
    if (
      ["/index", "/_index", "/_layout", "/_route", ".route"].every(
        (suffix) => !name.endsWith(suffix)
      )
    ) {
      // ignore non-index routes
      return null;
    }
    if (name.endsWith(".route")) {
      // convert docs/readme.route to docs.readme/_index
      name = name.replace(/[/\\]/g, ".").replace(/\.route$/, "/_index");
    }
    name = path.dirname(name);
  }

  let routeSegments = getRouteSegments(name);
  for (let i = 0; i < routeSegments.length; i++) {
    let routeSegment = routeSegments[i];
    url = appendPathSegment(url, routeSegment, paramsPrefixChar);
  }
  return {
    id: path.join(baseDir, name),
    path: url,
    file: path.join(baseDir, routeFile),
    name,
    //parent: parent will be calculated after all routes are defined,
    index:
      routeSegments.at(-1) === "index" || routeSegments.at(-1) === "_index",
  };
}

function appendPathSegment(
  url: string,
  segment: string,
  paramsPrefixChar: string = "$"
) {
  if (segment) {
    if (["index", "_index"].some((name) => segment === name)) {
      // index routes don't affect the the path
      return url;
    }

    if (segment.startsWith("_")) {
      // handle pathless route (not included in url)
      return url;
    }
    if (segment.endsWith("_")) {
      // handle parent override
      segment = segment.substring(0, segment.length - 1);
    }
    if (segment.startsWith(paramsPrefixChar)) {
      // handle params
      segment = segment === paramsPrefixChar ? "*" : `:${segment.substring(1)}`;
    }
    if (url) url += "/";
    url += segment;
  }
  return url;
}

function getRouteSegments(name: string) {
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
        // process existing segment
        pushRouteSegment(routeSegment);
        routeSegment = "";
        state = "PATH";
        continue; // restart without advancing index
      case "PATH":
        if (isPathSeparator(char) && subState === "NORMAL") {
          state = "START";
          break;
        } else if (char === "[") {
          subState = "ESCAPE";
          break;
        } else if (char === "]") {
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

function isPathSeparator(char: string) {
  return char === "/" || char === path.win32.sep || char === ".";
}

export const visitFiles: VisitFilesFunction = (
  dir: string,
  visitor: (file: string) => void,
  baseDir = dir
) => {
  for (let filename of fs.readdirSync(dir)) {
    let file = path.resolve(dir, filename);
    let stat = fs.lstatSync(file);

    if (stat.isDirectory()) {
      visitFiles(file, visitor, baseDir);
    } else if (stat.isFile()) {
      visitor(path.relative(baseDir, file));
    }
  }
};

export type {
  DefineRouteFunction,
  DefineRouteOptions,
  DefineRouteChildren,
  RouteManifest,
  RouteInfo,
};
