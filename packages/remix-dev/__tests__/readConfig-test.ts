import path from "path";

import type { RemixConfig } from "../config";
import { readConfig } from "../config";

const remixRoot = path.resolve(__dirname, "./fixtures/stack");

describe("readConfig", () => {
  let config: RemixConfig;
  beforeEach(async () => {
    config = await readConfig(remixRoot);
  });

  it("generates a config", async () => {
    expect(config).toMatchInlineSnapshot(
      {
        rootDirectory: expect.any(String),
        appDirectory: expect.any(String),
        cacheDirectory: expect.any(String),
        devServerPort: expect.any(Number),
        serverBuildPath: expect.any(String),
        assetsBuildDirectory: expect.any(String),
        relativeAssetsBuildDirectory: expect.any(String),
        tsconfigPath: expect.any(String),
        future: {
          v2_meta: expect.any(Boolean),
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
        "entryServerFile": "entry.server.tsx",
        "future": Object {
          "v2_meta": Any<Boolean>,
        },
        "mdx": undefined,
        "publicPath": "/build/",
        "relativeAssetsBuildDirectory": Any<String>,
        "rootDirectory": Any<String>,
        "routes": Object {
          "root": Object {
            "file": "root.tsx",
            "id": "root",
            "path": "",
          },
        },
        "serverBuildPath": Any<String>,
        "serverBuildTarget": undefined,
        "serverBuildTargetEntryModule": "export * from \\"@remix-run/dev/server-build\\";",
        "serverDependenciesToBundle": Array [],
        "serverEntryPoint": undefined,
        "serverMode": "production",
        "serverModuleFormat": "cjs",
        "serverPlatform": "node",
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
