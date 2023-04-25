import path from "path";

import type { RemixConfig } from "../config";
import { serverBuildTargetWarning, readConfig } from "../config";

const remixRoot = path.resolve(__dirname, "./fixtures/stack");

describe("readConfig", () => {
  let config: RemixConfig;
  let warnStub;
  beforeEach(async () => {
    let consoleWarn = console.warn;
    warnStub = jest.fn();
    console.warn = warnStub;
    config = await readConfig(remixRoot);
    console.warn = consoleWarn;
  });

  it("generates a config", async () => {
    expect(warnStub).toHaveBeenCalledWith(serverBuildTargetWarning);
    expect(config).toMatchInlineSnapshot(
      {
        rootDirectory: expect.any(String),
        appDirectory: expect.any(String),
        cacheDirectory: expect.any(String),
        devServerPort: expect.any(Number),
        serverBuildPath: expect.any(String),
        assetsBuildDirectory: expect.any(String),
        relativeAssetsBuildDirectory: expect.any(String),
        entryClientFilePath: expect.any(String),
        entryServerFilePath: expect.any(String),
        tsconfigPath: expect.any(String),
        future: {
          unstable_postcss: expect.any(Boolean),
          unstable_tailwind: expect.any(Boolean),
          v2_errorBoundary: expect.any(Boolean),
          v2_meta: expect.any(Boolean),
          v2_normalizeFormMethod: expect.any(Boolean),
          v2_routeConvention: expect.any(Boolean),
        },
      },
      `
      Object {
        "appDirectory": Any<String>,
        "assetsBuildDirectory": Any<String>,
        "cacheDirectory": Any<String>,
        "devServerBroadcastDelay": 0,
        "devServerPort": Any<Number>,
        "entryClientFile": "entry.client.tsx",
        "entryClientFilePath": Any<String>,
        "entryServerFile": "entry.server.tsx",
        "entryServerFilePath": Any<String>,
        "future": Object {
          "unstable_dev": false,
          "unstable_postcss": Any<Boolean>,
          "unstable_tailwind": Any<Boolean>,
          "v2_errorBoundary": Any<Boolean>,
          "v2_meta": Any<Boolean>,
          "v2_normalizeFormMethod": Any<Boolean>,
          "v2_routeConvention": Any<Boolean>,
        },
        "mdx": undefined,
        "postcss": false,
        "publicPath": "/build/",
        "relativeAssetsBuildDirectory": Any<String>,
        "rootDirectory": Any<String>,
        "routes": Object {
          "root": Object {
            "file": "root.tsx",
            "id": "root",
          },
        },
        "serverBuildPath": Any<String>,
        "serverBuildTarget": "node-cjs",
        "serverBuildTargetEntryModule": "export * from \\"@remix-run/dev/server-build\\";",
        "serverConditions": undefined,
        "serverDependenciesToBundle": Array [],
        "serverEntryPoint": undefined,
        "serverMainFields": Array [
          "main",
          "module",
        ],
        "serverMinify": false,
        "serverMode": "production",
        "serverModuleFormat": "cjs",
        "serverPlatform": "node",
        "tailwind": false,
        "tsconfigPath": Any<String>,
        "watchPaths": Array [],
      }
    `
    );
  });

  it("returns the same devServerPort value across reloads", async () => {
    let newConfig = await readConfig(remixRoot);
    expect(newConfig.devServerPort).toBe(config.devServerPort);
  });
});
