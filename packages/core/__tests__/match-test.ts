import { matchAndLoadData } from "../match";
import readRemixConfig from "../readRemixConfig";
import path from "path";

describe("matchAndLoadData", () => {
  let root;
  let config;

  beforeAll(async () => {
    root = path.resolve(__dirname, "../../../fixtures/gists-app");
    config = await readRemixConfig(root);
  });

  it("works", async () => {
    let url = "/gists";
    let appLoadContext = null;
    let result = await matchAndLoadData(config, url, appLoadContext);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Array [
          Object {},
          Object {},
        ],
        "status": "SUCCESS",
      }
    `);
  });

  it("returns NoMatch status", async () => {
    let url = "/carnitas/street/tacos/are/the/best";
    let appLoadContext = null;
    let result = await matchAndLoadData(config, url, appLoadContext);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "status": "NO_MATCH",
      }
    `);
  });
});
