import { resolve } from "node:path";
import pick from "lodash/pick";
import {
  type UNSAFE_RouteConfigEntry as RouteConfigEntry,
  UNSAFE_getRouteConfigAppDirectory as getRouteConfigAppDirectory,
} from "@remix-run/dev";

/**
 * Provides the absolute path to the app directory, for use within `routes.ts`.
 * This is designed to support resolving file system routes.
 */
export function getAppDirectory() {
  return getRouteConfigAppDirectory();
}

const createConfigRouteOptionKeys = [
  "id",
  "index",
  "caseSensitive",
] as const satisfies ReadonlyArray<keyof RouteConfigEntry>;
type CreateRouteOptions = Pick<
  RouteConfigEntry,
  typeof createConfigRouteOptionKeys[number]
>;
/**
 * Helper function for creating a route config entry, for use within
 * `routes.ts`.
 */
function route(
  path: string | null | undefined,
  file: string,
  children?: RouteConfigEntry[]
): RouteConfigEntry;
function route(
  path: string | null | undefined,
  file: string,
  options: CreateRouteOptions,
  children?: RouteConfigEntry[]
): RouteConfigEntry;
function route(
  path: string | null | undefined,
  file: string,
  optionsOrChildren: CreateRouteOptions | RouteConfigEntry[] | undefined,
  children?: RouteConfigEntry[]
): RouteConfigEntry {
  let options: CreateRouteOptions = {};

  if (Array.isArray(optionsOrChildren) || !optionsOrChildren) {
    children = optionsOrChildren;
  } else {
    options = optionsOrChildren;
  }

  return {
    file,
    children,
    path: path ?? undefined,
    ...pick(options, createConfigRouteOptionKeys),
  };
}

const createIndexOptionKeys = ["id"] as const satisfies ReadonlyArray<
  keyof RouteConfigEntry
>;
type CreateIndexOptions = Pick<
  RouteConfigEntry,
  typeof createIndexOptionKeys[number]
>;
/**
 * Helper function for creating a route config entry for an index route, for use
 * within `routes.ts`.
 */
function index(file: string, options?: CreateIndexOptions): RouteConfigEntry {
  return {
    file,
    index: true,
    ...pick(options, createIndexOptionKeys),
  };
}

const createLayoutOptionKeys = ["id"] as const satisfies ReadonlyArray<
  keyof RouteConfigEntry
>;
type CreateLayoutOptions = Pick<
  RouteConfigEntry,
  typeof createLayoutOptionKeys[number]
>;
/**
 * Helper function for creating a route config entry for a layout route, for use
 * within `routes.ts`.
 */
function layout(file: string, children?: RouteConfigEntry[]): RouteConfigEntry;
function layout(
  file: string,
  options: CreateLayoutOptions,
  children?: RouteConfigEntry[]
): RouteConfigEntry;
function layout(
  file: string,
  optionsOrChildren: CreateLayoutOptions | RouteConfigEntry[] | undefined,
  children?: RouteConfigEntry[]
): RouteConfigEntry {
  let options: CreateLayoutOptions = {};

  if (Array.isArray(optionsOrChildren) || !optionsOrChildren) {
    children = optionsOrChildren;
  } else {
    options = optionsOrChildren;
  }

  return {
    file,
    children,
    ...pick(options, createLayoutOptionKeys),
  };
}

/**
 * Helper function for adding a path prefix to a set of routes without needing
 * to introduce a parent route file, for use within `routes.ts`.
 */
function prefix(
  prefixPath: string,
  routes: RouteConfigEntry[]
): RouteConfigEntry[] {
  return routes.map((route) => {
    if (route.index || typeof route.path === "string") {
      return {
        ...route,
        path: route.path ? joinRoutePaths(prefixPath, route.path) : prefixPath,
        children: route.children,
      };
    } else if (route.children) {
      return {
        ...route,
        children: prefix(prefixPath, route.children),
      };
    }
    return route;
  });
}

const helpers = { route, index, layout, prefix };
export { route, index, layout, prefix };
/**
 * Creates a set of route config helpers that resolve file paths relative to the
 * given directory, for use within `routes.ts`. This is designed to support
 * splitting route config into multiple files within different directories.
 */
export function relative(directory: string): typeof helpers {
  return {
    /**
     * Helper function for creating a route config entry, for use within
     * `routes.ts`. Note that this helper has been scoped, meaning that file
     * path will be resolved relative to the directory provided to the
     * `relative` call that created this helper.
     */
    route: (path, file, ...rest) => {
      return route(path, resolve(directory, file), ...(rest as any));
    },
    /**
     * Helper function for creating a route config entry for an index route, for
     * use within `routes.ts`. Note that this helper has been scoped, meaning
     * that file path will be resolved relative to the directory provided to the
     * `relative` call that created this helper.
     */
    index: (file, ...rest) => {
      return index(resolve(directory, file), ...(rest as any));
    },
    /**
     * Helper function for creating a route config entry for a layout route, for
     * use within `routes.ts`. Note that this helper has been scoped, meaning
     * that file path will be resolved relative to the directory provided to the
     * `relative` call that created this helper.
     */
    layout: (file, ...rest) => {
      return layout(resolve(directory, file), ...(rest as any));
    },

    // Passthrough of helper functions that don't need relative scoping so that
    // a complete API is still provided.
    prefix,
  };
}

function joinRoutePaths(path1: string, path2: string): string {
  return [
    path1.replace(/\/+$/, ""), // Remove trailing slashes
    path2.replace(/^\/+/, ""), // Remove leading slashes
  ].join("/");
}
