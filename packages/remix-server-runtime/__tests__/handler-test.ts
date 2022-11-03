import { json } from "../responses";
import { createRequestHandler } from "../server";

describe("createRequestHandler", () => {
  it("retains request headers when stripping body off for loaders", async () => {
    // @ts-expect-error
    let handler = createRequestHandler({
      routes: {
        root: {
          id: "routes/test",
          path: "/test",
          module: {
            loader: ({ request }) => json(request.headers.get("X-Foo")),
          } as any,
        },
      },
      assets: {} as any,
      entry: { module: {} as any },
    });

    let response = await handler(
      new Request("http://.../test", {
        headers: {
          "X-Foo": "bar",
        },
        signal: new AbortController().signal,
      })
    );

    expect(await response.json()).toBe("bar");
  });
});
