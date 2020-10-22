import fs from "fs";
import path from "path";

/**
 * A route that was created using defineRoutes or created conventionally from
 * looking at the files on the filesystem.
 */
export interface ConfigRouteObject {
  /**
   * Should be `true` if the `path` is case-sensitive.
   */
  caseSensitive?: boolean;

  /**
   * This route's child routes.
   */
  children?: ConfigRouteObject[];

  /**
   * The path to the file that exports the React component rendered by this
   * route as its default export, relative to the `config.appDirectory`. So the
   * component file for route id `routes/gists/$username` will be
   * `routes/gists/$username.js`.
   */
  componentFile: string;

  /**
   * The unique id for this route, named like the `componentFile` but without
   * the file extension. So `routes/gists/$username.js` will have an `id` of
   * `routes/gists/$username`.
   */
  id: string;

  /**
   * The path to the file that exports the data loader for this route as its
   * default export, relative to `config.loadersDirectory`. So the loader for
   * `routes/gists/$username.js` will be `routes/gists/$username.js`.
   */
  loaderFile?: string;

  /**
   * The unique `id` for this route's parent route, if there is one.
   */
  parentId?: string;

  /**
   * The path this route uses to match on the URL pathname.
   */
  path: string;

  /**
   * The path to the file that contains styles for this route, relative to
   * `config.appDirectory`. So the styles for `routes/gists/$username.js` will
   * be `routes/gists/$username.css`.
   */
  stylesFile?: string;
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
   * The path to the file that exports the data loader for this route as its
   * default export, relative to `config.loadersDirectory`.
   */
  loader?: string;

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
 * A function for defining a route.
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
     */
    component: string,

    optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,
    children?: DefineRouteChildren
  ): void;
}

/**
 * The interface for defining routes programmatically, instead of using the
 * filesystem convention.
 */
export function defineRoutes(
  callback: (defineRoute: DefineRoute) => void
): ConfigRouteObject[] {
  let routes: ConfigRouteObject[] = [];
  let current: ConfigRouteObject[] = [];
  let alreadyReturned = false;

  function defineRoute(
    path: string,
    component: string,
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

    let id = normalizeSlashes(stripFileExtension(component));
    let parent = current[current.length - 1];
    let route: ConfigRouteObject = { id, path, componentFile: component };

    if (parent && parent.id) {
      route.parentId = parent.id;
    }

    // signature overloading
    if (typeof optionsOrChildren === "function") {
      // route(path, component, children)
      children = optionsOrChildren;
    } else if (optionsOrChildren != null) {
      // route(path, component, options, children)
      // route(path, component, options)
      let options = optionsOrChildren;
      if (typeof options.caseSensitive !== "undefined") {
        route.caseSensitive = !!options.caseSensitive;
      }
      if (options.loader) {
        route.loaderFile = options.loader;
      }
      if (options.styles) {
        route.stylesFile = options.styles;
      }
    }

    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(route);
    } else {
      routes.push(route);
    }

    if (children) {
      current.push(route);
      children();
      current.pop();
    }
  }

  callback(defineRoute);

  alreadyReturned = true;

  return routes;
}

function normalizeSlashes(file: string): string {
  return file.split(path.win32.sep).join("/");
}

function stripFileExtension(file: string): string {
  let extname = path.extname(file);
  return extname ? file.slice(0, -extname.length) : file;
}

/**
 * Reads routes from the filesystem using a naming and nesting convention to
 * define route paths and nested relations.
 */
export function getConventionalRoutes(
  appDir: string,
  dataDir: string
): ConfigRouteObject[] {
  return defineRoutes(defineRoute => {
    defineRoutesInDirectory(
      defineRoute,
      appDir,
      dataDir,
      path.join(appDir, "routes")
    );
  });
}

function defineRoutesInDirectory(
  defineRoute: DefineRoute,
  appDir: string,
  loadersDir: string,
  currentDir: string,
  basePath = ""
): void {
  let filenames = fs.readdirSync(currentDir);

  for (let filename of filenames) {
    let file = path.resolve(currentDir, filename);

    let routePath: string;
    let componentFile: string;
    let defineChildren: DefineRouteChildren | undefined;

    if (fs.lstatSync(file).isDirectory()) {
      let layoutFilename = filenames.find(
        f => isRouteModuleFilename(f) && barename(f) === filename
      );

      if (!layoutFilename) {
        // There is no layout route for this directory. Continue reading
        // conventional routes from the subdirectory.
        let base = (basePath ? `${basePath}/` : "") + filename;
        defineRoutesInDirectory(defineRoute, appDir, loadersDir, file, base);
      }

      continue;
    } else if (isRouteModuleFilename(filename)) {
      routePath =
        barename(filename) === "index"
          ? "/"
          : createRoutePath(
              (basePath ? `${basePath}/` : "") + barename(filename)
            );
      componentFile = path.resolve(currentDir, filename);

      let layoutDir = filenames.find(
        f =>
          f !== filename &&
          f === barename(filename) &&
          fs.lstatSync(path.join(currentDir, f)).isDirectory()
      );

      if (layoutDir) {
        // This is a layout route.
        let subdir = path.join(currentDir, layoutDir);
        defineChildren = () => {
          defineRoutesInDirectory(defineRoute, appDir, loadersDir, subdir);
        };
      } else {
        // This is a leaf route.
        defineChildren = undefined;
      }
    } else {
      // Not a directory or a route module, so it's probably a styles file.
      continue;
    }

    let loaderFile = findLoaderFile(
      path.dirname(
        path.resolve(
          path.join(loadersDir, "routes"),
          path.relative(path.join(appDir, "routes"), componentFile)
        )
      ),
      barename(componentFile)
    );
    let stylesFile = findStylesFile(
      path.dirname(file),
      barename(componentFile)
    );

    let component = path.relative(appDir, componentFile);
    let loader = loaderFile && path.relative(loadersDir, loaderFile);
    let styles = stylesFile && path.relative(appDir, stylesFile);

    defineRoute(routePath, component, { loader, styles }, defineChildren);
  }
}

function createRoutePath(filenameWithoutExt: string): string {
  return filenameWithoutExt.replace(/\$/g, ":").replace(/\./g, "/");
}

const routeModuleExts = [".cjs", ".md", ".mdx", ".js", ".jsx", ".ts", ".tsx"];

export function isRouteModuleFilename(filename: string): boolean {
  return routeModuleExts.includes(path.extname(filename));
}

const loaderExts = [".cjs", ".js", ".jsx", ".ts", ".tsx"];

export function isLoaderFilename(filename: string): boolean {
  return loaderExts.includes(path.extname(filename));
}

const stylesExts = [".css"];

export function isStylesFilename(filename: string): boolean {
  return stylesExts.includes(path.extname(filename));
}

function findLoaderFile(dir: string, name: string): string | undefined {
  return findFile(
    dir,
    filename => isLoaderFilename(filename) && barename(filename) === name
  );
}

function findStylesFile(dir: string, name: string): string | undefined {
  return findFile(
    dir,
    filename => isStylesFilename(filename) && barename(filename) === name
  );
}

function findFile(
  dir: string,
  test: (filename: string) => boolean
): string | undefined {
  let filename = fs.existsSync(dir) && fs.readdirSync(dir).find(test);
  return filename ? path.join(dir, filename) : undefined;
}

function barename(file: string): string {
  return path.basename(file, path.extname(file));
}
