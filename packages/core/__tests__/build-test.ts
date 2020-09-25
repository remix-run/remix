import path from "path";

import { build, BuildTarget } from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

const remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");

describe("the server build", () => {
  let config: RemixConfig;
  beforeEach(async () => {
    config = await readConfig(remixRoot);
  });

  it("generates a bundle for each input", async () => {
    let serverBuild = await build(config, { target: BuildTarget.Server });
    let { output } = await serverBuild.generate({
      exports: "named",
      format: "cjs"
    });

    expect(output.map(value => value.name).filter(Boolean))
      .toMatchInlineSnapshot(`
      Array [
        "routes/404",
        "routes/gists",
        "routes/gists/$username",
        "routes/gists/$username/edit",
        "routes/gists/index",
        "routes/gists.mine",
        "routes/index",
        "routes/payments",
        "routes/payments/error",
        "routes/users",
        "routes/users/$username",
        "pages/one",
        "pages/two",
        "entry-server",
        "global.css",
        "style/routes/gists.css",
        "style/routes/users.css",
      ]
    `);
  });
});
