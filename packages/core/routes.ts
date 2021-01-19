/**
 * A route that was created using `defineRoutes` or created conventionally from
 * looking at the files on the filesystem.
 */
export interface ConfigRouteObject {
  /**
   * The path this route uses to match on the URL pathname.
   */
  path: string;

  /**
   * This route's child routes.
   */
  children?: ConfigRouteObject[];

  /**
   * The unique id for this route, named like the `moduleFile` but without
   * the file extension. So `routes/gists/$username.js` will have an `id` of
   * `routes/gists/$username`.
   */
  id: string;

  /**
   * The unique `id` for this route's parent route, if there is one.
   */
  parentId?: string;

  /**
   * The path to the file that exports the React component rendered by this
   * route as its default export, relative to the `config.appDirectory`. So the
   * module file for route id `routes/gists/$username` will be
   * `routes/gists/$username.js`.
   */
  moduleFile: string;

  /**
   * The path to the file that contains styles for this route, relative to
   * `config.appDirectory`. So the styles file for the component in
   * `routes/gists/$username.js` will be `routes/gists/$username.css`.
   */
  stylesFile?: string;

  /**
   * Should be `true` if the `path` is case-sensitive.
   */
  caseSensitive?: boolean;
}

export type FlatConfigRouteObject = Omit<ConfigRouteObject, "children">;

export interface RouteManifest<RouteObject = FlatConfigRouteObject> {
  [routeId: string]: RouteObject;
}

export function createRouteManifest(
  routes: ConfigRouteObject[],
  manifest: RouteManifest = {}
): RouteManifest {
  for (let route of routes) {
    let { children, ...rest } = route;
    manifest[route.id] = rest;
    if (children) {
      createRouteManifest(children, manifest);
    }
  }

  return manifest;
}

export interface DefineRouteOptions {
  /**
   * Should be `true` if the route `path` is case-sensitive. Defaults to
   * `false`.
   */
  caseSensitive?: boolean;

  /**
   * The path to the file that defines CSS styles for this route, relative to
   * `config.appDirectory`.
   */
  styles?: string;
}

/**
 * A function for defining child routes.
 */
interface DefineRouteChildren {
  (): void;
}

/**
 * A function for defining a route that is passed as the argument to the
 * `defineRoutes` callback.
 *
 * Calls to this function are designed to be nested, using the `children`
 * callback argument.
 *
 *   defineRoutes(route => {
 *     route('/', 'pages/layout', () => {
 *       route('react-router', 'pages/react-router');
 *       route('reach-ui', 'pages/reach-ui');
 *     });
 *   });
 */
export interface DefineRoute {
  (
    /**
     * The path this route uses to match the URL pathname.
     */
    path: string,

    /**
     * The path to the file that exports the React component rendered by this
     * route as its default export, relative to `config.appDirectory`.
     * Additional exports may include `headers`, `meta`, `loader`, `action`,
     * and `ErrorBoundary`.
     */
    moduleFile: string,

    optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,
    children?: DefineRouteChildren
  ): void;
}

export type DefineRoutes = typeof defineRoutes;

/**
 * A function for defining routes programmatically, instead of using the
 * filesystem convention.
 */
export function defineRoutes(
  callback: (defineRoute: DefineRoute) => void
): ConfigRouteObject[] {
  let routes: ConfigRouteObject[] = [];
  let currentParents: ConfigRouteObject[] = [];
  let alreadyReturned = false;

  function defineRoute(
    path: string,
    moduleFile: string,
    optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,
    children?: DefineRouteChildren
  ): void {
    if (alreadyReturned) {
      throw new Error(
        "You tried to define routes asynchronously but started defining " +
          "routes before the async work was done. Please await all async " +
          "data before calling `defineRoutes()`"
      );
    }

    let options: DefineRouteOptions;
    if (typeof optionsOrChildren === "function") {
      // route(path, moduleFile, children)
      options = {};
      children = optionsOrChildren;
    } else {
      // route(path, moduleFile, options, children)
      // route(path, moduleFile, options)
      options = optionsOrChildren || {};
    }

    let route: ConfigRouteObject = {
      id: createRouteId(moduleFile),
      path: path || "/",
      moduleFile
    };

    if (typeof options.caseSensitive !== "undefined") {
      route.caseSensitive = !!options.caseSensitive;
    }
    if (options.styles) {
      route.stylesFile = options.styles;
    }

    let parentRoute = currentParents[currentParents.length - 1];
    if (parentRoute) {
      route.parentId = parentRoute.id;
      if (!parentRoute.children) parentRoute.children = [];
      parentRoute.children.push(route);
    } else {
      routes.push(route);
    }

    if (children) {
      currentParents.push(route);
      children();
      currentParents.pop();
    }
  }

  callback(defineRoute);

  alreadyReturned = true;

  return routes;
}

export function createRouteId(file: string) {
  return normalizeSlashes(stripFileExtension(file));
}

function normalizeSlashes(file: string) {
  return file.split("\\").join("/");
}

function stripFileExtension(file: string) {
  return file.replace(/\.[a-z0-9]+$/i, "");
}
