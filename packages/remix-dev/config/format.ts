import type { RouteManifest } from "./routes";

export function formatRoutes(routeManifest: RouteManifest) {
  let output = "<Routes>";

  function handleRoutesRecursive(parentId?: string, level = 1): boolean {
    let routes = Object.values(routeManifest).filter(
      route => route.parentId === parentId
    );

    let indent = Array(level * 2)
      .fill(" ")
      .join("");

    for (let route of routes) {
      output += "\n" + indent;
      output += `<Route${
        route.path ? ` path=${JSON.stringify(route.path)}` : ""
      }${route.index ? " index" : ""} element=${JSON.stringify(route.file)}>`;
      if (handleRoutesRecursive(route.id, level + 1)) {
        output += "\n" + indent;
        output += "</Route>";
      } else {
        output = output.slice(0, -1) + " />";
      }
    }

    return routes.length > 0;
  }

  handleRoutesRecursive();

  output += "\n</Routes>";

  return output;
}
