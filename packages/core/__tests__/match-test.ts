import path from "path";

import { matchAndLoadData } from "../match";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

describe("matchAndLoadData", () => {
  let remixRoot: string;
  let remixConfig: RemixConfig;

  beforeAll(async () => {
    remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");
    remixConfig = await readConfig(remixRoot);
  });

  it("loads data", async () => {
    let url = "/gists";
    let loadContext = null;
    let result = await matchAndLoadData(remixConfig, url, loadContext);
    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": null,
          "id": "routes/gists",
          "params": Object {},
          "status": "SUCCESS",
        },
        Object {
          "data": Array [
            Object {
              "files": Object {
                "remix-server.jsx": Object {
                  "filename": "remix-server.jsx",
                },
              },
              "id": "610613b54e5b34f8122d1ba4a3da21a9",
              "owner": Object {
                "avatar_url": "https://avatars0.githubusercontent.com/u/100200?v=4",
                "id": 100200,
                "login": "ryanflorence",
              },
              "url": "https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9",
            },
          ],
          "id": "routes/gists/index",
          "params": Object {},
          "status": "SUCCESS",
        },
      ]
    `);
  });

  describe("when there is no matching route", () => {
    it("returns null", async () => {
      let url = "/carnitas/street/tacos/are/the/best";
      let loadContext = null;
      let result = await matchAndLoadData(remixConfig, url, loadContext);
      expect(result).toBe(null);
    });
  });

  describe("when a nested loader throws", () => {
    it("handles errors", async () => {
      let url = "/payments/error";
      let loadContext = null;
      let result = await matchAndLoadData(remixConfig, url, loadContext);
      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            "data": null,
            "id": "routes/payments",
            "params": Object {},
            "status": "SUCCESS",
          },
          Object {
            "error": "Boom",
            "id": "routes/payments/error",
            "params": Object {},
            "status": "ERROR",
          },
        ]
      `);
    });
  });
});
