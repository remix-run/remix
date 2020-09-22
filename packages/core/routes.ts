import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";

const fileExtensionRegex = /(.*)\.([^.]+)$/;

function stripFileExtension(file: string): string {
  return file.replace(fileExtensionRegex, "$1");
}

/**
 * A route that was created using defineRoutes or created conventionally from
 * looking at the files on the filesystem.
 */
export interface RemixRouteObject {
  /**
   * The unique id for this route.
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
   * route as its default export, relative to the src/ directory.
   */
  componentFile: string;

  /**
   * The path to the file that exports the data loader for this route as its
   * default export, relative to the `config.loadersDirectory`.
   */
  loaderFile?: string;

  /**
   * The path to the file that contains styles for this route, relative to the
   * `config.stylesDirectory`.
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
   * loaders/invoices.js will be invoices.js.
   */
  loader?: string;

  /**
   * The path to the file that defines CSS styles for this route, relative to
   * the `config.stylesDirectory`.
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
export async function getConventionalRoutes(
  routesDir: string,
  loadersDir: string,
  stylesDir: string
): Promise<RemixRouteObject[]> {
  // TODO: Validate the directories exist
  let [routesTree, loadersTree] = await Promise.all([
    readdirRecursively(routesDir),
    readdirRecursively(loadersDir)
  ]);
  let routesDirRoot = path.basename(routesDir);
  let loadersMap = createLoadersMap(loadersTree, [], {});

  return defineRoutes(defineRoute => {
    let parents: string[] = [];
    return defineFileTree(
      routesTree,
      loadersMap,
      stylesDir,
      parents,
      routesDirRoot,
      defineRoute
    );
  });
}

function defineFileTree(
  routesTree: DirTree,
  loadersMap: LoadersMap,
  stylesDir: string,
  parents: string[],
  routesDir: string,
  defineRoute: DefineRoute
): void {
  // calculate this stuff first so we don't have to loop inside of our loop
  // to match up a directory to a route ("checkout.js" and "checkout/")
  let dirs = [];
  let routePaths = [];
  for (let filePath of routesTree) {
    let isDir = Array.isArray(filePath);
    dirs.push(isDir ? filePath[0] : false);
    routePaths.push(isDir ? false : makeRoutePath(filePath as string));
  }

  for (let index = 0, l = routesTree.length; index < l; index++) {
    let item = routesTree[index];
    let isDir = dirs[index];

    // define a route from a directory
    if (isDir) {
      let dirPath = item[0];
      let children = item[1] as DirTree;
      let routePath = makeRoutePath(dirPath);
      let layoutPathIndex = routePaths.indexOf(routePath);
      let filePath =
        layoutPathIndex === -1
          ? "$OUTLET$"
          : makeFullPath(routesTree[layoutPathIndex] as string, [
              routesDir,
              ...parents
            ]);

      let loader = findLoader(routePath, loadersMap, parents);
      let styles = findStyles(makeFullPath(routePath, parents), stylesDir);

      defineRoute(routePath, filePath, { loader, styles }, () => {
        defineFileTree(
          children,
          loadersMap,
          stylesDir,
          [...parents, dirPath],
          routesDir,
          defineRoute
        );
      });
    }

    // define a route from a file
    else {
      let fileName = item as string;

      // ignore "checkout.js" because "checkout" will define it
      let maybeDirName = makeRoutePath(fileName);
      let dirExists = dirs.indexOf(maybeDirName) !== -1;
      if (dirExists) continue;

      // ignore routes.json and whatever weird stuff they have
      let ignore = !/\.(jsx?|tsx?|mdx?)$/.test(fileName);
      if (ignore) continue;

      let routePath = makeRoutePath(fileName);
      let loader = findLoader(routePath, loadersMap, parents);
      let styles = findStyles(makeFullPath(routePath, parents), stylesDir);
      let filePath = makeFullPath(fileName, [routesDir, ...parents]);

      defineRoute(routePath, filePath, { loader, styles });
    }
  }
}

function findStyles(routePath: string, stylesDir: string): string | undefined {
  // /gists => /styles/gists.css
  let stylesFile = path.join(stylesDir, `${routePath}.css`);
  return fs.existsSync(stylesFile)
    ? stylesFile.slice(stylesDir.length + 1)
    : undefined;
}

type LoaderId = string;
type LoaderPath = string;
type LoadersMap = Record<LoaderId, LoaderPath>;

function createLoadersMap(
  loadersTree: DirTree,
  parents: string[],
  map: LoadersMap
): LoadersMap {
  for (let index = 0, l = loadersTree.length; index < l; index++) {
    let item = loadersTree[index];
    let isDirectory = Array.isArray(item);
    if (isDirectory) {
      let dirPath = item[0];
      createLoadersMap(item[1] as DirTree, [...parents, dirPath], map);
    } else {
      let fileName = item as string;
      let routePath = makeRoutePath(fileName);
      let loaderId = [...parents, routePath]
        .join("/")
        // hackin' around index routes
        .replace(/\/$/, "index");
      map[loaderId] = [...parents, fileName].join("/");
    }
  }
  return map;
}

function findLoader(
  routePath: string,
  loadersMap: LoadersMap,
  parents: string[]
) {
  let loaderPath = makeFullPath(routePath, parents)
    // hackin' around index routes
    .replace(/\/$/, "/index")
    .replace(/^\//, "");
  return loadersMap[loaderPath];
}

type DirTreeNode = string | [string, DirTree];
type DirTree = DirTreeNode[];

async function readdirRecursively(dirPath: string): Promise<DirTree> {
  let filePaths = await fsp.readdir(dirPath);

  let dirs = await Promise.all(
    filePaths.map(async file => {
      let stat = await fsp.lstat(path.join(dirPath, file));
      return stat.isDirectory();
    })
  );

  let tree: DirTree = [];
  for (let index = 0, l = filePaths.length; index < l; index++) {
    let filePath = filePaths[index];
    let isDir = dirs[index];
    if (isDir) {
      let children = await readdirRecursively(path.join(dirPath, filePath));
      tree.push([filePath, children]);
    } else {
      tree.push(filePath);
    }
  }

  return tree;
}

function makeRoutePath(filePath: string) {
  let filePathWithoutExt = stripFileExtension(filePath);
  let routePath =
    filePathWithoutExt === "index"
      ? "/"
      : filePathWithoutExt.replace(/\./g, "/").replace(/\$/g, ":");
  return routePath === "404" ? "*" : routePath;
}

function makeFullPath(child: string, parents: string[]) {
  return (
    [...parents, child]
      .join("/")
      // TODO: probably a better way to kill the gross double "//" on index routes
      .replace(/\/\/$/, "/")
  );
}
