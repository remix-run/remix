import * as path from "path";

import { BuildOptions, BuildTarget } from "../build";
import type { RemixConfig } from "../config";

export function getServerEntryPointModule(
  config: RemixConfig,
  options: BuildOptions,
  assetsModuleId = "./assets.json"
): string {
  switch (options.target) {
    case BuildTarget.Node14:
      return `
import * as entryServer from ${JSON.stringify(config.entryServerFile)};
${Object.keys(config.routeManifest)
  .map((key, index) => {
    return `import * as route${index} from ${JSON.stringify(
      path.resolve(config.appDirectory, config.routeManifest[key].moduleFile)
    )};`;
  })
  .join("\n")}
export { default as assets } from ${JSON.stringify(assetsModuleId)};
export const entry = { module: entryServer };
export const routes = {
  ${Object.keys(config.routeManifest)
    .map((key, index) => {
      let route = config.routeManifest[key];
      return `${JSON.stringify(key)}: {
  id: ${JSON.stringify(route.id)},
  parentId: ${JSON.stringify(route.parentId)},
  path: ${JSON.stringify(route.path)},
  caseSensitive: ${JSON.stringify(route.caseSensitive)},
  module: route${index}
}`;
    })
    .join(",\n  ")}
};`;

    default:
      throw new Error(
        `Cannot generate server entry point module for target: ${options.target}`
      );
  }
}
