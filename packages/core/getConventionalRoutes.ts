import { promises as fsp } from "fs";
import path from "path";

import defineRoutes, { DefineRoute } from "./defineRoutes";

////////////////////////////////////////////////////////////////////////////////
export default async function getConventionalRoutes(
  routesDir: string,
  loadersDir: string
) {
  await validateDirectories(routesDir, loadersDir);
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
      parents,
      routesDirRoot,
      defineRoute
    );
  });
}

////////////////////////////////////////////////////////////////////////////////
let sourceRegex = /\.(jsx?|tsx?|mdx?)$/;
let fileExtensionRegex = /(.*)\.([^.]+)$/;

async function validateDirectories(routesDir: string, loadersDir: string) {
  // TODO: validate the conventional directories exist
}

function defineFileTree(
  routesTree: DirTree,
  loadersMap: LoadersMap,
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
    let isDirectory = dirs[index];

    // define a route from a directory
    if (isDirectory) {
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
      defineRoute(routePath, filePath, loader, () => {
        defineFileTree(
          children,
          loadersMap,
          [...parents, dirPath],
          routesDir,
          defineRoute
        );
      });
    }

    // define a route from a file
    else {
      let fileName = item as string;
      let maybeDirName = makeRoutePath(fileName);
      let dirExists = dirs.indexOf(maybeDirName) !== -1;
      // ignore "checkout.js" because "checkout" will define it
      if (dirExists) continue;
      // ignore routes.json and whatever weird stuff they have
      let ignore = !sourceRegex.test(fileName);
      if (ignore) continue;
      let routePath = makeRoutePath(fileName);
      let loader = findLoader(routePath, loadersMap, parents);
      let filePath = makeFullPath(fileName, [routesDir, ...parents]);
      defineRoute(routePath, filePath, loader);
    }
  }
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
  let filePathWithoutExt = filePath.replace(fileExtensionRegex, "$1");
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
