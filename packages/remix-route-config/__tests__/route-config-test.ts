import path from "node:path";
import { normalizePath } from "vite";

import { route, layout, index, prefix, relative } from "../routes";

function cleanPathsForSnapshot(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === "string" && path.isAbsolute(value)) {
        return normalizePath(value.replace(process.cwd(), "{{CWD}}"));
      }
      return value;
    })
  );
}

describe("route config", () => {
  describe("route helpers", () => {
    describe("route", () => {
      it("supports basic routes", () => {
        expect(route("path", "file.tsx")).toMatchInlineSnapshot(`
          {
            "children": undefined,
            "file": "file.tsx",
            "path": "path",
          }
        `);
      });

      it("supports children", () => {
        expect(route("parent", "parent.tsx", [route("child", "child.tsx")]))
          .toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": undefined,
                "file": "child.tsx",
                "path": "child",
              },
            ],
            "file": "parent.tsx",
            "path": "parent",
          }
        `);
      });

      it("supports custom IDs", () => {
        expect(route("path", "file.tsx", { id: "custom-id" }))
          .toMatchInlineSnapshot(`
          {
            "children": undefined,
            "file": "file.tsx",
            "id": "custom-id",
            "path": "path",
          }
        `);
      });

      it("supports custom IDs with children", () => {
        expect(
          route("parent", "parent.tsx", { id: "custom-id" }, [
            route("child", "child.tsx"),
          ])
        ).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": undefined,
                "file": "child.tsx",
                "path": "child",
              },
            ],
            "file": "parent.tsx",
            "id": "custom-id",
            "path": "parent",
          }
        `);
      });

      it("supports case sensitive routes", () => {
        expect(route("path", "file.tsx", { caseSensitive: true }))
          .toMatchInlineSnapshot(`
          {
            "caseSensitive": true,
            "children": undefined,
            "file": "file.tsx",
            "path": "path",
          }
        `);
      });

      it("supports pathless index", () => {
        expect(route(null, "file.tsx", { index: true })).toMatchInlineSnapshot(`
          {
            "children": undefined,
            "file": "file.tsx",
            "index": true,
            "path": undefined,
          }
        `);
      });

      it("ignores unsupported options", () => {
        expect(
          // @ts-expect-error unsupportedOption
          route(null, "file.tsx", {
            index: true,
            unsupportedOption: 123,
          })
        ).toMatchInlineSnapshot(`
          {
            "children": undefined,
            "file": "file.tsx",
            "index": true,
            "path": undefined,
          }
        `);
      });
    });

    describe("index", () => {
      it("supports basic routes", () => {
        expect(index("file.tsx")).toMatchInlineSnapshot(`
          {
            "file": "file.tsx",
            "index": true,
          }
        `);
      });

      it("supports custom IDs", () => {
        expect(index("file.tsx", { id: "custom-id" })).toMatchInlineSnapshot(`
          {
            "file": "file.tsx",
            "id": "custom-id",
            "index": true,
          }
        `);
      });

      it("ignores unsupported options", () => {
        expect(
          index("file.tsx", {
            id: "custom-id",
            // @ts-expect-error
            unsupportedOption: 123,
          })
        ).toMatchInlineSnapshot(`
          {
            "file": "file.tsx",
            "id": "custom-id",
            "index": true,
          }
        `);
      });
    });

    describe("layout", () => {
      it("supports basic routes", () => {
        expect(layout("layout.tsx")).toMatchInlineSnapshot(`
          {
            "children": undefined,
            "file": "layout.tsx",
          }
        `);
      });

      it("supports children", () => {
        expect(layout("layout.tsx", [route("child", "child.tsx")]))
          .toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": undefined,
                "file": "child.tsx",
                "path": "child",
              },
            ],
            "file": "layout.tsx",
          }
        `);
      });

      it("supports custom IDs", () => {
        expect(layout("layout.tsx", { id: "custom-id" }))
          .toMatchInlineSnapshot(`
          {
            "children": undefined,
            "file": "layout.tsx",
            "id": "custom-id",
          }
        `);
      });

      it("supports custom IDs with children", () => {
        expect(
          layout("layout.tsx", { id: "custom-id" }, [
            route("child", "child.tsx"),
          ])
        ).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": undefined,
                "file": "child.tsx",
                "path": "child",
              },
            ],
            "file": "layout.tsx",
            "id": "custom-id",
          }
        `);
      });
    });

    describe("prefix", () => {
      it("adds a prefix to routes", () => {
        expect(prefix("prefix", [route("route", "routes/route.tsx")]))
          .toMatchInlineSnapshot(`
          [
            {
              "children": undefined,
              "file": "routes/route.tsx",
              "path": "prefix/route",
            },
          ]
        `);
      });

      it("adds a prefix to routes with a blank path", () => {
        expect(prefix("prefix", [route("", "routes/route.tsx")]))
          .toMatchInlineSnapshot(`
          [
            {
              "children": undefined,
              "file": "routes/route.tsx",
              "path": "prefix",
            },
          ]
        `);
      });

      it("adds a prefix with a trailing slash to routes", () => {
        expect(prefix("prefix/", [route("route", "routes/route.tsx")]))
          .toMatchInlineSnapshot(`
          [
            {
              "children": undefined,
              "file": "routes/route.tsx",
              "path": "prefix/route",
            },
          ]
        `);
      });

      it("adds a prefix to routes with leading slash", () => {
        expect(prefix("prefix", [route("/route", "routes/route.tsx")]))
          .toMatchInlineSnapshot(`
          [
            {
              "children": undefined,
              "file": "routes/route.tsx",
              "path": "prefix/route",
            },
          ]
        `);
      });

      it("adds a prefix with a trailing slash to routes with leading slash", () => {
        expect(prefix("prefix/", [route("/route", "routes/route.tsx")]))
          .toMatchInlineSnapshot(`
          [
            {
              "children": undefined,
              "file": "routes/route.tsx",
              "path": "prefix/route",
            },
          ]
        `);
      });

      it("adds a prefix to index routes", () => {
        expect(prefix("prefix", [index("routes/index.tsx")]))
          .toMatchInlineSnapshot(`
          [
            {
              "children": undefined,
              "file": "routes/index.tsx",
              "index": true,
              "path": "prefix",
            },
          ]
        `);
      });

      it("adds a prefix to children of layout routes", () => {
        expect(
          prefix("prefix", [
            layout("routes/layout.tsx", [route("route", "routes/route.tsx")]),
          ])
        ).toMatchInlineSnapshot(`
          [
            {
              "children": [
                {
                  "children": undefined,
                  "file": "routes/route.tsx",
                  "path": "prefix/route",
                },
              ],
              "file": "routes/layout.tsx",
            },
          ]
        `);
      });

      it("adds a prefix to children of nested layout routes", () => {
        expect(
          prefix("prefix", [
            layout("routes/layout-1.tsx", [
              route("layout-1-child", "routes/layout-1-child.tsx"),
              layout("routes/layout-2.tsx", [
                route("layout-2-child", "routes/layout-2-child.tsx"),
                layout("routes/layout-3.tsx", [
                  route("layout-3-child", "routes/layout-3-child.tsx"),
                ]),
              ]),
            ]),
          ])
        ).toMatchInlineSnapshot(`
          [
            {
              "children": [
                {
                  "children": undefined,
                  "file": "routes/layout-1-child.tsx",
                  "path": "prefix/layout-1-child",
                },
                {
                  "children": [
                    {
                      "children": undefined,
                      "file": "routes/layout-2-child.tsx",
                      "path": "prefix/layout-2-child",
                    },
                    {
                      "children": [
                        {
                          "children": undefined,
                          "file": "routes/layout-3-child.tsx",
                          "path": "prefix/layout-3-child",
                        },
                      ],
                      "file": "routes/layout-3.tsx",
                    },
                  ],
                  "file": "routes/layout-2.tsx",
                },
              ],
              "file": "routes/layout-1.tsx",
            },
          ]
        `);
      });
    });

    describe("relative", () => {
      it("supports relative routes", () => {
        let { route } = relative(path.join(process.cwd(), "/path/to/dirname"));
        expect(
          cleanPathsForSnapshot(
            route("parent", "nested/parent.tsx", [
              route("child", "nested/child.tsx", { id: "child" }),
            ])
          )
        ).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "file": "{{CWD}}/path/to/dirname/nested/child.tsx",
                "id": "child",
                "path": "child",
              },
            ],
            "file": "{{CWD}}/path/to/dirname/nested/parent.tsx",
            "path": "parent",
          }
        `);
      });

      it("supports relative index routes", () => {
        let { index } = relative(path.join(process.cwd(), "/path/to/dirname"));
        expect(
          cleanPathsForSnapshot([
            index("nested/without-options.tsx"),
            index("nested/with-options.tsx", { id: "with-options" }),
          ])
        ).toMatchInlineSnapshot(`
          [
            {
              "file": "{{CWD}}/path/to/dirname/nested/without-options.tsx",
              "index": true,
            },
            {
              "file": "{{CWD}}/path/to/dirname/nested/with-options.tsx",
              "id": "with-options",
              "index": true,
            },
          ]
        `);
      });

      it("supports relative layout routes", () => {
        let { layout } = relative(path.join(process.cwd(), "/path/to/dirname"));
        expect(
          cleanPathsForSnapshot(
            layout("nested/parent.tsx", [
              layout("nested/child.tsx", { id: "child" }),
            ])
          )
        ).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "file": "{{CWD}}/path/to/dirname/nested/child.tsx",
                "id": "child",
              },
            ],
            "file": "{{CWD}}/path/to/dirname/nested/parent.tsx",
          }
        `);
      });

      it("provides passthrough for non-relative APIs", () => {
        let { prefix: relativePrefix } = relative("/path/to/dirname");
        expect(relativePrefix).toBe(prefix);
      });
    });
  });
});
