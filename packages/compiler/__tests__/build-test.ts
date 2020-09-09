import path from "path";

import build from "../build";

describe("build", () => {
  let remixRoot: string;

  beforeAll(async () => {
    remixRoot = path.resolve(__dirname, "../../../fixtures/gists-app");
  });

  it("works", async () => {
    let bundle = await build({ remixRoot });
    let { output } = await bundle.generate({
      exports: "named",
      format: "cjs"
    });

    let names = output.map(value => value.name);

    expect(names).toMatchInlineSnapshot(`
      Array [
        "routes/404",
        "routes/gists",
        "routes/gists/$username",
        "routes/gists/index",
        "routes/gists.mine",
        "routes/index",
        "routes/payments",
        "routes/payments/error",
        "__entry_server__",
      ]
    `);
  });
});
