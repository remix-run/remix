import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";

function stripFileExtension(file: string): string {
  let extname = path.extname(file);
  return extname ? file.slice(0, -extname.length) : file;
}

function normalizeSlashes(file: string): string {
  return file.split(path.win32.sep).join("/");
}

/**
 * A route that was created using defineRoutes or created conventionally from
 * looking at the files on the filesystem.
 */
export interface RemixRouteObject {
  /**
   * The unique id for this route, named like the `componentFile`. So
   * `routes/gists/$username.js` will have an `id` of `routes/gists/$username`.
   */
  id: string;

  /**
   * The unique id for this route's parent route, if there is one.
   */
  parentId?: string;

  /**
   * The path this route uses to match on the URL pathname.
   */
  path: string;

  /**
   * The path to the file that exports the React component rendered by this
   * route as its default export, relative to the `config.appDirectory`. So the
   * component file for route id `routes/gists/$username` will be
   * `routes/gists/$username.js`.
   */
  componentFile: string;

  /**
   * The path to the file that exports the data loader for this route as its
   * default export, relative to the `config.dataDirectory`. So the loader for
   * `routes/gists/$username.js` will be `loaders/gists/$username.js`.
   */
  loaderFile?: string;

  /**
   * The path to the file that contains styles for this route, relative to the
   * `config.appDirectory`. So the styles for `routes/gists/$username.js` will
   * be `styles/gists/$username.css`.
   */
  stylesFile?: string;

  /**
   * This route's child routes.
   */
  children?: RemixRouteObject[];
}

export interface DefineRouteOptions {
  /**
   * The path to the file that exports the data loader for this route as its
   * default export, relative to the `config.loadersDirectory`. So the path for
   * `src/routes/invoices.js` will be `loaders/routes/invoices.js`.
   */
  loader?: string;

  /**
   * The path to the file that defines CSS styles for this route, relative to
   * the `config.stylesDirectory`. So the path for `src/routes/invoices.js` will
   * be `src/styles/invoices.js`.
   */
  styles?: string;
}

type DefineRouteChildren = () => void;

export interface DefineRoute {
  (
    /**
     * The path this route uses to match the URL pathname.
     */
    path: string,

    /**
     * The path to the file that exports the React component rendered by this
     * route as its default export, relative to the src/ directory. So the path
     * for src/routes/home.js will be routes/home.js and src/articles/welcome.md
     * will be articles/welcome.md.
     */
    component: string,

    /**
     * The path to the file that exports the data loader for this route as its
     * default export, relative to the loaders/ directory. So the path for
     * loaders/invoices.js will be invoices.js.
     */
    optionsOrChildren?: DefineRouteOptions | (() => void),

    /**
     * A function for defining this route's child routes.
     */
    children?: DefineRouteChildren
  ): void;
}

/**
 * The interface for defining routes programmatically, instead of using the
 * filesystem convention.
 */
export function defineRoutes(
  getRoutes: (defineRoute: DefineRoute) => void
): RemixRouteObject[] {
  let routes: RemixRouteObject[] = [];
  let current: RemixRouteObject[] = [];
  let returned = false;

  function defineRoute(
    path: string,
    component: string,
    optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,
    children?: DefineRouteChildren
  ): void {
    if (returned) throwAsyncError();

    let id = stripFileExtension(component);
    let parent = current[current.length - 1];
    let route: RemixRouteObject = { id, path, componentFile: component };

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
      if (optionsOrChildren.loader) {
        route.loaderFile = optionsOrChildren.loader;
      }
      if (optionsOrChildren.styles) {
        route.stylesFile = optionsOrChildren.styles;
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

  getRoutes(defineRoute);

  returned = true;

  return routes;
}

function throwAsyncError() {
  throw new Error(
    "You tried to define routes asynchronously but started defining routes before the async work was done. Please await all async data before calling `defineRoutes()`"
  );
}

/**
 * Reads routes from the filesystem using a naming and nesting convention to
 * define route paths and nested relations.
 */
export function getConventionalRoutes(
  appDirectory: string,
  dataDirectory: string
): RemixRouteObject[] {
  return defineRoutes(defineRoute => {
    defineRoutesInDirectory(
      defineRoute,
      appDirectory,
      dataDirectory,
      path.join(appDirectory, "routes")
    );
  });
}

function defineRoutesInDirectory(
  defineRoute: DefineRoute,
  appDirectory: string,
  dataDirectory: string,
  currentDir: string
): void {
  let files = fs.readdirSync(currentDir);

  for (let filename of files) {
    let file = path.join(currentDir, filename);

    if (fs.lstatSync(file).isDirectory()) {
      let layoutFilename = files.find(
        f => f !== filename && stripFileExtension(f) === filename
      );

      if (!layoutFilename) {
        throw new Error(`No layout exists for directory ${file}`);
      }

      let routePath = filename.replace(/\$/g, ":").replace(/\./g, "/"); // :username
      let component = path.relative(
        appDirectory,
        path.join(currentDir, layoutFilename)
      ); // routes/gists/$username.js
      let loader = findFileWithRouteId(dataDirectory, "loaders", component); // loaders/gists/$username.js
      let styles = findFileWithRouteId(appDirectory, "styles", component); // styles/gists/$username.css

      defineRoute(routePath, component, { loader, styles }, () => {
        defineRoutesInDirectory(defineRoute, appDirectory, dataDirectory, file);
      });
    } else {
      let isLayout = files.some(
        f => f !== filename && f === stripFileExtension(path.basename(filename))
      );

      if (isLayout) {
        // This is a layout file with sub-routes that were already/will be
        // defined when the directory entry is processed.
        continue;
      }

      // This is a "leaf" route.
      let routePath =
        stripFileExtension(filename) === "index"
          ? "/" // index route
          : stripFileExtension(filename.replace(/\$/g, ":")).replace(
              /\./g,
              "/"
            ); // :username
      let component = path.relative(appDirectory, file); // routes/gists/$username.js
      let loader = findFileWithRouteId(dataDirectory, "loaders", component); // loaders/gists/$username.js
      let styles = findFileWithRouteId(appDirectory, "styles", component); // styles/gists/$username.css

      defineRoute(routePath, component, { loader, styles });
    }
  }
}

// Find the loader/styles file in the directory with the same basename
// as the route component file, regardless of its file extension.
// gists/$username => gists/$username.js
// gists/$username => gists/$username.ts
// gists/$username => gists/$username.css
function findFileWithRouteId(
  baseDir: string,
  subDir: string,
  componentFile: string
): string | undefined {
  // baseDir = app
  // subDir = styles
  // componentFile = routes/gists/$username.js
  // target = styles/gists/$username
  let target = stripFileExtension(componentFile.replace(/^routes\b/, subDir));
  // dir = app/styles/gists
  let dir = path.dirname(path.join(baseDir, target));

  if (fs.existsSync(dir) && fs.lstatSync(dir).isDirectory()) {
    let files = fs.readdirSync(dir);
    let basename = path.basename(target);
    let file = files.find(
      f =>
        !fs.lstatSync(path.join(dir, f)).isDirectory() &&
        stripFileExtension(f) === basename
    );
    if (file) return `${target}${path.extname(file)}`;
  }

  return undefined;
}
