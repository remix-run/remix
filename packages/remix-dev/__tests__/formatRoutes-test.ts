import {
  createHierarchicalRoutes,
  formatRoutes,
  RoutesFormat,
} from "../config/format";

describe("createHierarchicalRoutes", () => {
  test("adds parent route for index routes with path", () => {
    let manifestRoutes = {
      root: { path: "", id: "root", file: "root.tsx" },
      "routes/index": {
        index: true,
        id: "routes/index",
        parentId: "root",
        file: "routes/index.tsx",
      },
      "routes/nested/index": {
        path: "nested",
        index: true,
        id: "routes/nested/index",
        parentId: "root",
        file: "routes/nested/index.tsx",
      },
    };

    function createHierarchyRoute(id: string, path: string | undefined) {
      let { file, index } = manifestRoutes[id] || {};
      // lazy way to remove undefined values from output :)
      return JSON.parse(JSON.stringify({ id, path, file, index }));
    }

    expect(createHierarchicalRoutes(manifestRoutes, createHierarchyRoute))
      .toMatchInlineSnapshot(`
      Array [
        Object {
          "children": Array [
            Object {
              "children": Array [],
              "file": "routes/index.tsx",
              "id": "routes/index",
              "index": true,
            },
            Object {
              "children": Array [
                Object {
                  "children": Array [],
                  "file": "routes/nested/index.tsx",
                  "id": "routes/nested/index",
                  "index": true,
                  "path": undefined,
                },
              ],
              "id": "routes/nested",
              "path": "nested",
            },
          ],
          "file": "root.tsx",
          "id": "root",
          "path": "",
        },
      ]
    `);
  });

  test("does not adds parent route for pathless route without index sibling", () => {
    let manifestRoutes = {
      root: { path: "", id: "root", file: "root.tsx" },
      "routes/index": {
        index: true,
        id: "routes/index",
        parentId: "root",
        file: "routes/index.tsx",
      },
      "routes/nested/__pathless": {
        path: "nested",
        id: "routes/nested/__pathless",
        parentId: "root",
        file: "routes/nested/__pathless.tsx",
      },
      "routes/nested/__pathless/foo": {
        path: "foo",
        id: "routes/nested/__pathless/foo",
        parentId: "routes/nested/__pathless",
        file: "routes/nested/__pathless/foo.tsx",
      },
    };

    function createHierarchyRoute(id: string, path: string | undefined) {
      let { file, index } = manifestRoutes[id] || {};
      // lazy way to remove undefined values from output :)
      return JSON.parse(JSON.stringify({ id, path, file, index }));
    }

    expect(createHierarchicalRoutes(manifestRoutes, createHierarchyRoute))
      .toMatchInlineSnapshot(`
      Array [
        Object {
          "children": Array [
            Object {
              "children": Array [],
              "file": "routes/index.tsx",
              "id": "routes/index",
              "index": true,
            },
            Object {
              "children": Array [
                Object {
                  "children": Array [],
                  "file": "routes/nested/__pathless/foo.tsx",
                  "id": "routes/nested/__pathless/foo",
                  "path": "foo",
                },
              ],
              "file": "routes/nested/__pathless.tsx",
              "id": "routes/nested/__pathless",
              "path": "nested",
            },
          ],
          "file": "root.tsx",
          "id": "root",
          "path": "",
        },
      ]
    `);
  });

  test("adds parent route for pathless routes with index sibling", () => {
    let manifestRoutes = {
      root: { path: "", id: "root", file: "root.tsx" },
      "routes/index": {
        index: true,
        id: "routes/index",
        parentId: "root",
        file: "routes/index.tsx",
      },
      "routes/nested/__pathless": {
        path: "nested",
        id: "routes/nested/__pathless",
        parentId: "root",
        file: "routes/nested/__pathless.tsx",
      },
      "routes/nested/__pathless/foo": {
        path: "foo",
        id: "routes/nested/__pathless/foo",
        parentId: "routes/nested/__pathless",
        file: "routes/nested/__pathless/foo.tsx",
      },
      "routes/nested/index": {
        path: "nested",
        index: true,
        id: "routes/nested/index",
        parentId: "root",
        file: "routes/nested/index.tsx",
      },
    };

    function createHierarchyRoute(id: string, path: string | undefined) {
      let { file, index } = manifestRoutes[id] || {};
      // lazy way to remove undefined values from output :)
      return JSON.parse(JSON.stringify({ id, path, file, index }));
    }

    expect(createHierarchicalRoutes(manifestRoutes, createHierarchyRoute))
      .toMatchInlineSnapshot(`
      Array [
        Object {
          "children": Array [
            Object {
              "children": Array [],
              "file": "routes/index.tsx",
              "id": "routes/index",
              "index": true,
            },
            Object {
              "children": Array [
                Object {
                  "children": Array [
                    Object {
                      "children": Array [],
                      "file": "routes/nested/__pathless/foo.tsx",
                      "id": "routes/nested/__pathless/foo",
                      "path": "foo",
                    },
                  ],
                  "file": "routes/nested/__pathless.tsx",
                  "id": "routes/nested/__pathless",
                  "path": undefined,
                },
                Object {
                  "children": Array [],
                  "file": "routes/nested/index.tsx",
                  "id": "routes/nested/index",
                  "index": true,
                  "path": undefined,
                },
              ],
              "id": "routes/nested",
              "path": "nested",
            },
          ],
          "file": "root.tsx",
          "id": "root",
          "path": "",
        },
      ]
    `);
  });

  test("creates hierarchy for non-index route structures", () => {
    let manifestRoutes = {
      root: { path: "", id: "root", file: "root.tsx" },
      "routes/parent1": {
        path: "parent1",
        id: "routes/parent1",
        parentId: "root",
        file: "routes/parent1.tsx",
      },
      "routes/parent1/child1": {
        path: "child1",
        id: "routes/parent1/child1",
        parentId: "routes/parent1",
        file: "routes/parent1/child1.tsx",
      },
      "routes/parent2": {
        path: "parent2",
        id: "routes/parent2",
        parentId: "root",
        file: "routes/parent2.tsx",
      },
      "routes/parent2/child2": {
        path: "child2",
        id: "routes/parent2/child2",
        parentId: "routes/parent2",
        file: "routes/parent2/child2.tsx",
      },
    };

    function createHierarchyRoute(id: string, path: string | undefined) {
      let { file, index } = manifestRoutes[id] || {};
      // lazy way to remove undefined values from output :)
      return JSON.parse(JSON.stringify({ id, path, file, index }));
    }

    expect(createHierarchicalRoutes(manifestRoutes, createHierarchyRoute))
      .toMatchInlineSnapshot(`
      Array [
        Object {
          "children": Array [
            Object {
              "children": Array [
                Object {
                  "children": Array [],
                  "file": "routes/parent1/child1.tsx",
                  "id": "routes/parent1/child1",
                  "path": "child1",
                },
              ],
              "file": "routes/parent1.tsx",
              "id": "routes/parent1",
              "path": "parent1",
            },
            Object {
              "children": Array [
                Object {
                  "children": Array [],
                  "file": "routes/parent2/child2.tsx",
                  "id": "routes/parent2/child2",
                  "path": "child2",
                },
              ],
              "file": "routes/parent2.tsx",
              "id": "routes/parent2",
              "path": "parent2",
            },
          ],
          "file": "root.tsx",
          "id": "root",
          "path": "",
        },
      ]
    `);
  });
});

describe("formatRoutes", () => {
  test("formats in JSX and JSON", () => {
    let configRoutes = {
      root: { path: "", id: "root", file: "root.tsx" },
      "routes/index": {
        index: true,
        id: "routes/index",
        parentId: "root",
        file: "routes/index.tsx",
      },
      "routes/nested/__pathless": {
        path: "nested",
        id: "routes/nested/__pathless",
        parentId: "root",
        file: "routes/nested/__pathless.tsx",
      },
      "routes/nested/__pathless/foo": {
        path: "foo",
        id: "routes/nested/__pathless/foo",
        parentId: "routes/nested/__pathless",
        file: "routes/nested/__pathless/foo.tsx",
      },
      "routes/nested/index": {
        path: "nested",
        index: true,
        id: "routes/nested/index",
        parentId: "root",
        file: "routes/nested/index.tsx",
      },
    };
    expect(formatRoutes(configRoutes, RoutesFormat.jsx)).toMatchInlineSnapshot(`
      "<Routes>
        <Route file=\\"root.tsx\\">
          <Route index file=\\"routes/index.tsx\\" />
          <Route path=\\"nested\\">
            <Route file=\\"routes/nested/__pathless.tsx\\">
              <Route path=\\"foo\\" file=\\"routes/nested/__pathless/foo.tsx\\" />
            </Route>
            <Route index file=\\"routes/nested/index.tsx\\" />
          </Route>
        </Route>
      </Routes>"
    `);
    expect(formatRoutes(configRoutes, RoutesFormat.json))
      .toMatchInlineSnapshot(`
      "[
        {
          \\"id\\": \\"root\\",
          \\"path\\": \\"\\",
          \\"file\\": \\"root.tsx\\",
          \\"children\\": [
            {
              \\"id\\": \\"routes/index\\",
              \\"index\\": true,
              \\"file\\": \\"routes/index.tsx\\",
              \\"children\\": []
            },
            {
              \\"id\\": \\"routes/nested\\",
              \\"path\\": \\"nested\\",
              \\"children\\": [
                {
                  \\"id\\": \\"routes/nested/__pathless\\",
                  \\"file\\": \\"routes/nested/__pathless.tsx\\",
                  \\"children\\": [
                    {
                      \\"id\\": \\"routes/nested/__pathless/foo\\",
                      \\"path\\": \\"foo\\",
                      \\"file\\": \\"routes/nested/__pathless/foo.tsx\\",
                      \\"children\\": []
                    }
                  ]
                },
                {
                  \\"id\\": \\"routes/nested/index\\",
                  \\"index\\": true,
                  \\"file\\": \\"routes/nested/index.tsx\\",
                  \\"children\\": []
                }
              ]
            }
          ]
        }
      ]"
    `);
  });
});
