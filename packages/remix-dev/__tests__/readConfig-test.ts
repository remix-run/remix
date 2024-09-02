import path from "node:path";

import { readConfig } from "../config";

describe("readConfig", () => {
  it("generates a config", async () => {
    let remixRoot = path.join(__dirname, "fixtures", "stack");
    let config = await readConfig(remixRoot);
    expect(config).toMatchInlineSnapshot(
      {
        rootDirectory: expect.any(String),
        appDirectory: expect.any(String),
        cacheDirectory: expect.any(String),
        serverBuildPath: expect.any(String),
        assetsBuildDirectory: expect.any(String),
        relativeAssetsBuildDirectory: expect.any(String),
        entryClientFilePath: expect.any(String),
        entryServerFilePath: expect.any(String),
        tsconfigPath: expect.any(String),
      },
      `
      {
        "appDirectory": Any<String>,
        "assetsBuildDirectory": Any<String>,
        "browserNodeBuiltinsPolyfill": undefined,
        "cacheDirectory": Any<String>,
        "dev": {},
        "entryClientFile": "entry.client.tsx",
        "entryClientFilePath": Any<String>,
        "entryServerFile": "entry.server.tsx",
        "entryServerFilePath": Any<String>,
        "future": {
          "unstable_lazyRouteDiscovery": false,
          "unstable_optimizeDeps": false,
          "unstable_singleFetch": false,
          "v3_fetcherPersist": false,
          "v3_relativeSplatPath": false,
          "v3_throwAbortReason": false,
        },
        "mdx": undefined,
        "postcss": true,
        "publicPath": "/build/",
        "relativeAssetsBuildDirectory": Any<String>,
        "rootDirectory": Any<String>,
        "routes": {
          "root": {
            "file": "root.tsx",
            "id": "root",
            "path": "",
          },
        },
        "serverBuildPath": Any<String>,
        "serverBuildTargetEntryModule": "export * from "@remix-run/dev/server-build";",
        "serverConditions": undefined,
        "serverDependenciesToBundle": [],
        "serverEntryPoint": undefined,
        "serverMainFields": [
          "module",
          "main",
        ],
        "serverMinify": false,
        "serverMode": "production",
        "serverModuleFormat": "esm",
        "serverNodeBuiltinsPolyfill": undefined,
        "serverPlatform": "node",
        "tailwind": true,
        "tsconfigPath": Any<String>,
        "watchPaths": [],
      }
    `
    );
  });

  it("generates a config for deno project", async () => {
    let remixRoot = path.join(__dirname, "fixtures", "deno");
    let config = await readConfig(remixRoot);
    expect(config).toEqual(
      expect.objectContaining({
        entryServerFile: "entry.server.deno.tsx",
      })
    );
  });
});
