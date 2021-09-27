import { defineRoutes } from "../config/routes";

describe("defineRoutes", () => {
  it("returns an array of routes", () => {
    let routes = defineRoutes(route => {
      route("/", "routes/home.js");
      route("inbox", "routes/inbox.js", () => {
        route("/", "routes/inbox/index.js");
        route(":messageId", "routes/inbox/$messageId.js");
        route("archive", "routes/inbox/archive.js");
      });
    });

    expect(routes).toMatchInlineSnapshot(`
      Object {
        "routes/home": Object {
          "caseSensitive": false,
          "file": "routes/home.js",
          "id": "routes/home",
          "index": true,
          "parentId": undefined,
          "path": undefined,
        },
        "routes/inbox": Object {
          "caseSensitive": false,
          "file": "routes/inbox.js",
          "id": "routes/inbox",
          "index": false,
          "parentId": undefined,
          "path": "inbox",
        },
        "routes/inbox/$messageId": Object {
          "caseSensitive": false,
          "file": "routes/inbox/$messageId.js",
          "id": "routes/inbox/$messageId",
          "index": false,
          "parentId": "routes/inbox",
          "path": ":messageId",
        },
        "routes/inbox/archive": Object {
          "caseSensitive": false,
          "file": "routes/inbox/archive.js",
          "id": "routes/inbox/archive",
          "index": false,
          "parentId": "routes/inbox",
          "path": "archive",
        },
        "routes/inbox/index": Object {
          "caseSensitive": false,
          "file": "routes/inbox/index.js",
          "id": "routes/inbox/index",
          "index": true,
          "parentId": "routes/inbox",
          "path": undefined,
        },
      }
    `);
  });

  it("works with async data", async () => {
    // Read everything *before* calling defineRoutes.
    let fakeDirectory = await Promise.resolve(["one.md", "two.md"]);
    let routes = defineRoutes(route => {
      for (let file of fakeDirectory) {
        route(file.replace(/\.md$/, ""), file);
      }
    });

    expect(routes).toMatchInlineSnapshot(`
      Object {
        "one": Object {
          "caseSensitive": false,
          "file": "one.md",
          "id": "one",
          "index": false,
          "parentId": undefined,
          "path": "one",
        },
        "two": Object {
          "caseSensitive": false,
          "file": "two.md",
          "id": "two",
          "index": false,
          "parentId": undefined,
          "path": "two",
        },
      }
    `);
  });
});
