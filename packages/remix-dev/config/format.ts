import type { ConfigRoute, RouteManifest } from "./routes";

export enum RoutesFormat {
  json = "json",
  jsx = "jsx",
}

export function isRoutesFormat(format: any): format is RoutesFormat {
  return format === RoutesFormat.json || format === RoutesFormat.jsx;
}

export function formatRoutes(
  routeManifest: RouteManifest,
  format: RoutesFormat
) {
  let routes = createHierarchicalRoutes<ConfigRoute, JsonFormattedRoute>(
    routeManifest,
    (route) => ({
      id: route.id,
      index: route.index,
      path: route.path,
      caseSensitive: route.caseSensitive,
      file: route.file,
    })
  );

  switch (format) {
    case RoutesFormat.json:
      return JSON.stringify(routes || null, null, 2);
    case RoutesFormat.jsx:
      return formatRoutesAsJsx(routes || []);
  }
}

type JsonFormattedRoute = {
  id: string;
  index?: boolean;
  path?: string;
  caseSensitive?: boolean;
  file: string;
  children?: JsonFormattedRoute[];
};

export function formatRoutesAsJsx(routes: JsonFormattedRoute[]) {
  let output = "<Routes>";

  function handleRoutesRecursive(
    routes: JsonFormattedRoute[],
    level = 1
  ): boolean {
    let indent = Array(level * 2)
      .fill(" ")
      .join("");

    for (let route of routes) {
      output += "\n" + indent;
      output += `<Route${
        route.path ? ` path=${JSON.stringify(route.path)}` : ""
      }${route.index ? " index" : ""}${
        route.file ? ` file=${JSON.stringify(route.file)}` : ""
      }>`;
      if (handleRoutesRecursive(route.children || [], level + 1)) {
        output += "\n" + indent;
        output += "</Route>";
      } else {
        output = output.slice(0, -1) + " />";
      }
    }

    return routes.length > 0;
  }

  handleRoutesRecursive(routes);

  output += "\n</Routes>";

  return output;
}

interface BaseManifestRoute {
  id: string;
  index?: boolean;
  path?: string;
  parentId?: string;
}

interface BaseHierarchyRoute {
  id: string;
  path?: string;
  children?: BaseHierarchyRoute[];
}

/**
 * NOTE: This function is duplicated in remix-dev, remix-react, and
 * remix-server-runtime so if you make changes please make them in all 3
 * locations. We'll look into DRY-ing this up after we layer Remix on top of
 * react-router@6.4
 *
 * Generic reusable function to convert a manifest into a react-router style
 * route hierarchy.  For use in server-side and client-side route creation,
 * as well and `remix routes` to keep them all in sync.
 *
 * This also handles inserting "folder" parent routes to help disambiguate
 * between pathless layout routes and index routes at the same level
 *
 * @param manifest     Map of string -> Route Object
 * @param createRoute  Function to create a hierarchical route given a manifest
 *                     ignoring children
 * @returns
 */
export function createHierarchicalRoutes<
  ManifestRoute extends BaseManifestRoute,
  HierarchyRoute extends BaseHierarchyRoute
>(
  manifest: Record<string, ManifestRoute>,
  createRoute: (r: ManifestRoute) => HierarchyRoute
) {
  function recurse(parentId?: string) {
    let routes = Object.values(manifest).filter(
      (route) => route.parentId === parentId
    );

    let children: HierarchyRoute[] = [];

    // Our manifest flattens index routes and their paths into a single
    // per-route-file entry, so we use this to track which index routes need
    // to be split back into a hierarchical pattern
    let indexRoutesWithPath: string[] = [];

    for (let route of routes) {
      if (route.index && route.path) {
        indexRoutesWithPath.push(route.path);
      }
      let hierarchicalRoute = createRoute(route);
      hierarchicalRoute.children = recurse(route.id);
      children.push(hierarchicalRoute);
    }

    // For each index route that _also_ had a path, create a new parent route
    // for the path and nest the index route and any other matching path routes
    indexRoutesWithPath.forEach((path) => {
      let otherPathRoutes: HierarchyRoute[] = [];
      let dupPathRoutes: HierarchyRoute[] = [];
      children.forEach((r) => {
        if (r.path === path) {
          dupPathRoutes.push(r);
        } else {
          otherPathRoutes.push(r);
        }
      });
      let folderRoute = {
        ...createRoute({
          id: `routes/${path}`,
          path,
        } as ManifestRoute),
        children: dupPathRoutes.map((r) => ({ ...r, path: undefined })),
      };
      children = [...otherPathRoutes, folderRoute];
    });

    return children;
  }

  return recurse();
}
