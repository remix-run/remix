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
  path?: string;
  parentId?: string;
}

interface BaseOutputRoute {
  id: string;
  path?: string;
  children?: BaseOutputRoute[];
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
function createHierarchicalRoutes<
  ManifestRoute extends BaseManifestRoute,
  OutputRoute extends BaseOutputRoute
>(
  manifest: Record<string, ManifestRoute>,
  createRoute: (r: ManifestRoute) => OutputRoute
) {
  function recurse(parentId?: string) {
    let routes = Object.values(manifest).filter(
      (route) => route.parentId === parentId
    );

    let children: OutputRoute[] = [];
    let pathCounts: Record<string, number> = {};

    for (let route of routes) {
      // Track in case we find duplicate paths and the same level, indicating
      // we need to insert a folder route
      if (route.path) {
        pathCounts[route.path] = (pathCounts[route.path] || 0) + 1;
      }
      let hierarchicalRoute = createRoute(route);
      hierarchicalRoute.children = recurse(route.id);
      children.push(hierarchicalRoute);
    }

    // If we found any duplicate paths, create a new folder-route and nest
    // the duplicate entires under that without paths since they inherit
    // from the new parent now
    Object.entries(pathCounts).forEach(([path, count]) => {
      if (count > 1) {
        let otherPathRoutes: OutputRoute[] = [];
        let dupPathRoutes: OutputRoute[] = [];
        children.forEach((r) => {
          if (r.path === path) {
            dupPathRoutes.push(r);
          } else {
            otherPathRoutes.push(r);
          }
        });
        // TODO: Need to figure out this typing error :/
        let folderRoute: OutputRoute = {
          id: `folder:routes/${path}`,
          path,
          children: dupPathRoutes.map((r) => ({ ...r, path: undefined })),
        };
        children = [...otherPathRoutes, folderRoute];
      }
    });

    return children;
  }

  return recurse();
}
