import * as path from "node:path";
import URL from "node:url";
import { test, expect } from "@playwright/test";
import { normalizePath } from "vite";
import getPort from "get-port";

import {
  createProject,
  viteDev,
  viteBuild,
  VITE_CONFIG,
} from "./helpers/vite.js";

test.describe(async () => {
  let port: number;
  let cwd: string;
  let stop: () => void;

  function pathStartsWithCwd(pathname: string) {
    return normalizePath(pathname).startsWith(normalizePath(cwd));
  }

  function relativeToCwd(pathname: string) {
    return normalizePath(path.relative(cwd, pathname));
  }

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      // These routes are used to smoke test config merging
      "app/routes/invalid-route.user-ignored.tsx": `
        INVALID SYNTAX THAT BREAKS THE BUILD IF THIS ROUTE IS NOT IGNORED;
      `,
      "app/routes/invalid-route.adapter-ignored.tsx": `
        INVALID SYNTAX THAT BREAKS THE BUILD IF THIS ROUTE IS NOT IGNORED;
      `,

      "vite.config.ts": await VITE_CONFIG({
        port,
        pluginOptions: `
          {
            adapter: async ({ remixConfig }) => ({
              remixConfig: {
                // This config is used to smoke test config merging
                ignoredRouteFiles: ["**/*.adapter-ignored.tsx"],

                serverBundles() {
                  // Smoke test that the Remix config passed in has default values
                  let hasDefaults = remixConfig.buildDirectory === "build";
                  if (!hasDefaults) {
                    throw new Error("Remix config does not have default values");
                  }

                  // Smoke test that the user config is passed in
                  let { ignoredRouteFiles } = remixConfig;
                  let serverBundleId = (ignoredRouteFiles[ignoredRouteFiles.length - 1]);
                  if (serverBundleId !== "adapter-server-bundle-id") {
                    throw new Error("Remix config does not have user config");
                  }

                  return serverBundleId;
                },
                async buildEnd(buildEndArgs) {
                  let fs = await import("node:fs/promises");
                  let serializeJs = (await import("serialize-javascript")).default;

                  await fs.writeFile(
                    "BUILD_END_ARGS.js",
                    "export default " + serializeJs(buildEndArgs, { space: 2, unsafe: true }),
                    "utf-8"
                  );
                },
              },
            }),

            ignoredRouteFiles: [
              // This value is used to smoke test config merging
              "**/*.user-ignored.tsx",

              // This is a no-op value used by the "serverBundles" function above
              "adapter-server-bundle-id"
            ],
          },
        `,
      }),
    });
    stop = await viteDev({ cwd, port });
  });
  test.afterAll(() => stop());

  test("Vite / adapter / serverBundles and buildEnd hooks", async () => {
    let { status } = viteBuild({ cwd });
    expect(status).toBe(0);

    let buildEndArgs: any = (
      await import(URL.pathToFileURL(path.join(cwd, "BUILD_END_ARGS.js")).href)
    ).default;
    let { remixConfig } = buildEndArgs;

    // Before rewriting to relative paths, assert that paths are absolute within cwd
    expect(pathStartsWithCwd(remixConfig.buildDirectory)).toBe(true);

    // Rewrite path args to be relative and normalized for snapshot test
    remixConfig.buildDirectory = relativeToCwd(remixConfig.buildDirectory);

    expect(Object.keys(buildEndArgs)).toEqual(["buildManifest", "remixConfig"]);

    // Smoke test the resolved config
    expect(Object.keys(buildEndArgs.remixConfig)).toEqual([
      "adapter",
      "appDirectory",
      "buildDirectory",
      "buildEnd",
      "future",
      "manifest",
      "publicPath",
      "routes",
      "serverBuildFile",
      "serverBundles",
      "serverModuleFormat",
      "unstable_ssr",
    ]);

    // Ensure we get a valid build manifest
    expect(buildEndArgs.buildManifest).toEqual({
      routeIdToServerBundleId: {
        "routes/_index": "adapter-server-bundle-id",
      },
      routes: {
        root: {
          file: "app/root.tsx",
          id: "root",
          path: "",
        },
        "routes/_index": {
          file: "app/routes/_index.tsx",
          id: "routes/_index",
          index: true,
          parentId: "root",
        },
      },
      serverBundles: {
        "adapter-server-bundle-id": {
          file: "build/server/adapter-server-bundle-id/index.js",
          id: "adapter-server-bundle-id",
        },
      },
    });
  });
});
