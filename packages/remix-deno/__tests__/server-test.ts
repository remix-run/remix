import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";

import {
  createRequestHandler,
  createRequestHandlerWithStaticFiles,
  serveStaticFiles
} from "../server";

jest.mock("@remix-run/server-runtime/server");
let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

describe("deno request handler", () => {
  let consoleSpy: jest.SpyInstance = jest
    .spyOn(global.console, "error")
    .mockImplementation(() => {}) as any;

  afterEach(() => {
    consoleSpy.mockReset();
    mockedCreateRequestHandler.mockReset();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it("handles requests", async () => {
    mockedCreateRequestHandler.mockImplementation(() => async req => {
      return new Response(`URL: ${new URL(req.url).pathname}`);
    });
    let handler = createRequestHandler({
      build: undefined
    });

    let response = await handler(new Request("http://test.com/foo/bar"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("URL: /foo/bar");
  });

  it("handles errors", async () => {
    let error = new Error("test error");
    mockedCreateRequestHandler.mockImplementation(() => async req => {
      throw error;
    });
    let handler = createRequestHandler({
      build: undefined
    });

    let response = await handler(new Request("http://test.com/foo/bar"));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Error");

    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("passes request context", async () => {
    let loadContext;
    mockedCreateRequestHandler.mockImplementation(() => async (req, ctx) => {
      loadContext = ctx;
      return new Response(`URL: ${new URL(req.url).pathname}`);
    });
    let context = {};
    let handler = createRequestHandler({
      build: undefined,
      getLoadContext: async () => context
    });

    let response = await handler(new Request("http://test.com/foo/bar"));
    expect(loadContext).toBe(context);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("URL: /foo/bar");
  });
});

describe("deno static files", () => {
  let options = {
    publicDir: "./public",
    assetsPublicPath: "/build/"
  };

  it("throws when no file", async () => {
    let error = new Error("test error");
    global.Deno.readFile.mockImplementation(() => {
      throw error;
    });

    let request = new Request("http://test.com/foo/bar");
    await expect(() => serveStaticFiles(request, options)).rejects.toThrow(
      error
    );
  });

  it("reads file and applies long cache control", async () => {
    global.Deno.readFile.mockImplementation(() => {
      return "file content";
    });

    let request = new Request("http://test.com/build/bar.css");
    let response = await serveStaticFiles(request, options);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(await response.text()).toBe("file content");
  });

  it("reads file and applies short cache control", async () => {
    global.Deno.readFile.mockImplementation(() => {
      return "file content";
    });

    let request = new Request("http://test.com/test/bar.css");
    let response = await serveStaticFiles(request, options);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=600");
    expect(await response.text()).toBe("file content");
  });

  it("reads file and applies custom cache control string", async () => {
    global.Deno.readFile.mockImplementation(() => {
      return "file content";
    });

    let request = new Request("http://test.com/test/bar.css");
    let response = await serveStaticFiles(request, {
      cacheControl: "public, max-age=1"
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=1");
    expect(await response.text()).toBe("file content");
  });

  it("reads file and applies custom cache control function", async () => {
    global.Deno.readFile.mockImplementation(() => {
      return "file content";
    });

    let request = new Request("http://test.com/test/bar.css");
    let response = await serveStaticFiles(request, {
      cacheControl: () => "public, max-age=2"
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=2");
    expect(await response.text()).toBe("file content");
  });
});

describe("deno combined request handler", () => {
  it("handles requests", async () => {
    global.Deno.readFile.mockImplementation(() => {
      let error = new Error("test error");
      (error as any).code = "ENOENT";
      throw error;
    });

    mockedCreateRequestHandler.mockImplementation(() => async req => {
      return new Response(`URL: ${new URL(req.url).pathname}`);
    });
    let handler = createRequestHandlerWithStaticFiles({
      build: undefined
    });

    let response = await handler(new Request("http://test.com/foo/bar"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("URL: /foo/bar");
  });

  it("handles static assets", async () => {
    global.Deno.readFile.mockImplementation(() => {
      return "file content";
    });

    mockedCreateRequestHandler.mockImplementation(() => async req => {
      return new Response(`URL: ${new URL(req.url).pathname}`);
    });
    let handler = createRequestHandlerWithStaticFiles({
      build: undefined
    });

    let response = await handler(new Request("http://test.com/foo/bar.css"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=600");
    expect(await response.text()).toBe("file content");
  });
});
