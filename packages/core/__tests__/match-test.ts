import { matchAndLoadData } from "../match";
import readRemixConfig from "../readRemixConfig";
import path from "path";

describe("match", () => {
  it("works", async () => {
    let root = path.resolve(__dirname, "../../../fixtures/gists-app");
    let config = await readRemixConfig(root);
    let url = "/gists";
    let appLoadContext = null;
    let result = await matchAndLoadData(config, url, appLoadContext);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "context": Array [
          Object {},
          Object {},
        ],
        "status": 1,
      }
    `);
  });
});
