import { defineRoutes } from "../config/routes";

describe("defineRoutes", () => {
  it("returns an array of routes", () => {
    let routes = defineRoutes((route) => {
      route("/", "routes/home.js");
      route("inbox", "routes/inbox.js", () => {
        route("/", "routes/inbox/index.js", { index: true });
        route(":messageId", "routes/inbox/$messageId.js");
        route("archive", "routes/inbox/archive.js");
      });
    });

    expect(routes).toMatchInlineSnapshot(`
      Object {
        "routes/home": Object {
          "caseSensitive": undefined,
          "file": "routes/home.js",
          "id": "routes/home",
          "index": undefined,
          "parentId": undefined,
          "path": "/",
        },
        "routes/inbox": Object {
          "caseSensitive": undefined,
          "file": "routes/inbox.js",
          "id": "routes/inbox",
          "index": undefined,
          "parentId": undefined,
          "path": "inbox",
        },
        "routes/inbox/$messageId": Object {
          "caseSensitive": undefined,
          "file": "routes/inbox/$messageId.js",
          "id": "routes/inbox/$messageId",
          "index": undefined,
          "parentId": "routes/inbox",
          "path": ":messageId",
        },
        "routes/inbox/archive": Object {
          "caseSensitive": undefined,
          "file": "routes/inbox/archive.js",
          "id": "routes/inbox/archive",
          "index": undefined,
          "parentId": "routes/inbox",
          "path": "archive",
        },
        "routes/inbox/index": Object {
          "caseSensitive": undefined,
          "file": "routes/inbox/index.js",
          "id": "routes/inbox/index",
          "index": true,
          "parentId": "routes/inbox",
          "path": "/",
        },
      }
    `);
  });

  it("works with async data", async () => {
    // Read everything *before* calling defineRoutes.
    let fakeDirectory = await Promise.resolve(["one.md", "two.md"]);
    let routes = defineRoutes((route) => {
      for (let file of fakeDirectory) {
        route(file.replace(/\.md$/, ""), file);
      }
    });

    expect(routes).toMatchInlineSnapshot(`
      Object {
        "one": Object {
          "caseSensitive": undefined,
          "file": "one.md",
          "id": "one",
          "index": undefined,
          "parentId": undefined,
          "path": "one",
        },
        "two": Object {
          "caseSensitive": undefined,
          "file": "two.md",
          "id": "two",
          "index": undefined,
          "parentId": undefined,
          "path": "two",
        },
      }
    `);
  });

  it("allows multiple routes with the same route module", () => {
    let routes = defineRoutes((route) => {
      route("/user/:id", "routes/index.tsx", { id: "user-by-id" });
      route("/user", "routes/index.tsx", { id: "user" });
      route("/other", "routes/other-route.tsx");
    });

    expect(routes).toMatchInlineSnapshot(`
      Object {
        "routes/other-route": Object {
          "caseSensitive": undefined,
          "file": "routes/other-route.tsx",
          "id": "routes/other-route",
          "index": undefined,
          "parentId": undefined,
          "path": "/other",
        },
        "user": Object {
          "caseSensitive": undefined,
          "file": "routes/index.tsx",
          "id": "user",
          "index": undefined,
          "parentId": undefined,
          "path": "/user",
        },
        "user-by-id": Object {
          "caseSensitive": undefined,
          "file": "routes/index.tsx",
          "id": "user-by-id",
          "index": undefined,
          "parentId": undefined,
          "path": "/user/:id",
        },
      }
    `);
  });

  it("throws an error on route id collisions", () => {
    // Two conflicting custom id's
    let defineNonUniqueRoutes = () => {
      defineRoutes((route) => {
        route("/user/:id", "routes/user.tsx", { id: "user" });
        route("/user", "routes/user.tsx", { id: "user" });
        route("/other", "routes/other-route.tsx");
      });
    };

    expect(defineNonUniqueRoutes).toThrowErrorMatchingInlineSnapshot(
      `"Unable to define routes with duplicate route id: \\"user\\""`
    );

    // Custom id conflicting with a later-defined auto-generated id
    defineNonUniqueRoutes = () => {
      defineRoutes((route) => {
        route("/user/:id", "routes/user.tsx", { id: "routes/user" });
        route("/user", "routes/user.tsx");
      });
    };

    expect(defineNonUniqueRoutes).toThrowErrorMatchingInlineSnapshot(
      `"Unable to define routes with duplicate route id: \\"routes/user\\""`
    );

    // Custom id conflicting with an earlier-defined auto-generated id
    defineNonUniqueRoutes = () => {
      defineRoutes((route) => {
        route("/user", "routes/user.tsx");
        route("/user/:id", "routes/user.tsx", { id: "routes/user" });
      });
    };

    expect(defineNonUniqueRoutes).toThrowErrorMatchingInlineSnapshot(
      `"Unable to define routes with duplicate route id: \\"routes/user\\""`
    );
  });
});
