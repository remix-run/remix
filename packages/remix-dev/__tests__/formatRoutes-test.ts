import { formatRoutes, RoutesFormat } from "../config/format";

describe("formatRoutes", () => {
  test("create hierarchical routes with inserted folder routes where needed", () => {
    let configRoutes = {
      root: { path: "", id: "root", file: "root.tsx" },
      "routes/nested/__pathless": {
        path: "nested",
        index: undefined,
        caseSensitive: undefined,
        id: "routes/nested/__pathless",
        parentId: "root",
        file: "routes/nested/__pathless.tsx",
      },
      "routes/nested/__pathless/foo": {
        path: "foo",
        index: undefined,
        caseSensitive: undefined,
        id: "routes/nested/__pathless/foo",
        parentId: "routes/nested/__pathless",
        file: "routes/nested/__pathless/foo.tsx",
      },
      "routes/nested/index": {
        path: "nested",
        index: true,
        caseSensitive: undefined,
        id: "routes/nested/index",
        parentId: "root",
        file: "routes/nested/index.tsx",
      },
      "routes/index": {
        path: undefined,
        index: true,
        caseSensitive: undefined,
        id: "routes/index",
        parentId: "root",
        file: "routes/index.tsx",
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
              \\"id\\": \\"folder:routes/nested\\",
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
