import * as fs from "node:fs";
import * as path from "node:path";
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

  test.beforeAll(async () => {
    port = await getPort();
    cwd = await createProject({
      "vite.config.ts": await VITE_CONFIG({
        port,
        pluginOptions: `
          {
            unstable_adapter: {
              async options(options) {
                return {
                  unstable_serverBundles(...args) {
                    // This lets us assert that user options are passed to adapter options hook
                    return options.unstable_serverBundles?.(...args) + "--adapter-options";
                  }
                }
              },
              async buildEnd(args) {
                let fs = await import("node:fs/promises");
                await fs.writeFile("BUILD_END_ARGS.json", JSON.stringify(args, null, 2), "utf-8");
              }
            },
            
            unstable_serverBundles() {
              return "user-options";
            }
          },
        `,
      }),
    });
    stop = await viteDev({ cwd, port });
  });
  test.afterAll(() => stop());

  test("Vite / adapter / options and buildEnd hooks", async () => {
    let { status } = viteBuild({ cwd });
    expect(status).toBe(0);

    expect(
      Object.keys(
        JSON.parse(
          fs.readFileSync(path.join(cwd, "build/server/bundles.json"), "utf8")
        ).serverBundles
      )
    ).toEqual(["user-options--adapter-options"]);

    let buildEndArgs: any = JSON.parse(
      fs.readFileSync(path.join(cwd, "BUILD_END_ARGS.json"), "utf8")
    );

    // Before rewriting to relative paths, assert that paths are absolute
    expect(path.isAbsolute(buildEndArgs.serverBuildDirectory)).toBe(true);
    expect(path.isAbsolute(buildEndArgs.assetsBuildDirectory)).toBe(true);

    // Rewrite path args to be relative and normalized for snapshot test
    buildEndArgs.serverBuildDirectory = normalizePath(
      path.relative(cwd, buildEndArgs.serverBuildDirectory)
    );
    buildEndArgs.assetsBuildDirectory = normalizePath(
      path.relative(cwd, buildEndArgs.assetsBuildDirectory)
    );

    expect(buildEndArgs).toEqual({
      assetsBuildDirectory: "build/client",
      isSpaMode: false,
      serverBuildDirectory: "build/server",
      serverBuildFile: "index.js",
      serverBundlesManifest: {
        routeIdToServerBundleId: {
          "routes/_index": "user-options--adapter-options",
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
          "user-options--adapter-options": {
            file: "build/server/user-options--adapter-options/index.js",
            id: "user-options--adapter-options",
          },
        },
      },
    });
  });
});
