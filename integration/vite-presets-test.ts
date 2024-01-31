import fs from "node:fs/promises";
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

const js = String.raw;

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
      "vite.config.ts": await VITE_CONFIG({
        port,
        pluginOptions: js`
          {
            presets: [
              {
                remixConfig: async ({ remixConfig }) => ({
                  // Smoke test that preset config takes lower precedence than user config
                  serverModuleFormat: "cjs",
                }),
                remixConfigResolved: async ({ remixConfig }) => {
                  // Ensure preset config takes lower precedence than user config
                  if (remixConfig.serverModuleFormat === "cjs") {
                    throw new Error("Remix preset config wasn't overridden with user config");
                  }
                }
              },
              {
                remixConfig: async ({ remixConfig }) => {
                  // Smoke test that Remix config values are accumulated across presets
                  if (remixConfig.serverModuleFormat !== "cjs") {
                    throw new Error("Remix config does not have accumulated values");
                  }
                  return {};
                },
              },
              {
                remixConfig: async ({ remixConfig }) => ({
                  // No-op preset so we can assert that more presets can't be defined within a preset
                  presets: [{}],
                }),
              },
              {
                remixConfig: async ({ remixConfig }) => {
                  // Smoke test that presets can't define more presets via Remix config
                  if (remixConfig.presets !== undefined) {
                    throw new Error("Remix preset config should ignore 'presets' key");
                  }
                  return {};
                },
              },
              {
                remixConfigResolved: async ({ remixConfig }) => {
                  let isDeepFrozen = (obj: any) =>
                    Object.isFrozen(obj) &&
                    Object.keys(obj).every(
                      prop => typeof obj[prop] !== 'object' || isDeepFrozen(obj[prop])
                    );

                  let fs = await import("node:fs/promises");
                  await fs.writeFile("PRESET_REMIX_CONFIG_RESOLVED_META.json", JSON.stringify({
                    remixConfigFrozen: isDeepFrozen(remixConfig),
                  }), "utf-8");
                }
              },
              {
                remixConfig: async ({ remixConfig }) => ({
                  serverBundles() {
                    return "preset-server-bundle-id";
                  },
                }),
              },
              {
                remixConfig: async ({ remixConfig }) => ({
                  async buildEnd(buildEndArgs) {
                    // Smoke test that the Remix config passed in has default values
                    let hasDefaults = remixConfig.buildDirectory === "build";
                    if (!hasDefaults) {
                      throw new Error("Remix config does not have default values");
                    }

                    let fs = await import("node:fs/promises");
                    let serializeJs = (await import("serialize-javascript")).default;

                    await fs.writeFile(
                      "BUILD_END_ARGS.js",
                      "export default " + serializeJs(buildEndArgs, { space: 2, unsafe: true }),
                      "utf-8"
                    );
                  },
                }),
              },
            ],

            // Smoke test that preset config takes lower precedence than user config
            serverModuleFormat: "esm",
          },
        `,
      }),
    });
    stop = await viteDev({ cwd, port });
  });
  test.afterAll(() => stop());

  test("Vite / presets", async () => {
    let { status, stderr } = viteBuild({ cwd });
    expect(stderr.toString()).toBeFalsy();
    expect(status).toBe(0);

    let buildEndArgs: any = (
      await import(URL.pathToFileURL(path.join(cwd, "BUILD_END_ARGS.js")).href)
    ).default;
    let { remixConfig } = buildEndArgs;

    // Before rewriting to relative paths, assert that paths are absolute within cwd
    expect(pathStartsWithCwd(remixConfig.buildDirectory)).toBe(true);

    // Rewrite path args to be relative and normalized for snapshot test
    remixConfig.buildDirectory = relativeToCwd(remixConfig.buildDirectory);

    // Ensure preset config takes lower precedence than user config
    expect(remixConfig.serverModuleFormat).toBe("esm");

    // Ensure `remixConfigResolved` is called with a frozen Remix config
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(cwd, "PRESET_REMIX_CONFIG_RESOLVED_META.json"),
          "utf-8"
        )
      )
    ).toEqual({
      remixConfigFrozen: true,
    });

    expect(Object.keys(buildEndArgs)).toEqual(["buildManifest", "remixConfig"]);

    // Smoke test the resolved config
    expect(Object.keys(buildEndArgs.remixConfig)).toEqual([
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
        "routes/_index": "preset-server-bundle-id",
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
        "preset-server-bundle-id": {
          file: "build/server/preset-server-bundle-id/index.js",
          id: "preset-server-bundle-id",
        },
      },
    });
  });
});
