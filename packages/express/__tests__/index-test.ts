import express from "express";
import supertest from "supertest";

import { createRequestHandler } from "../index";

import { Response } from "@remix-run/core/fetch";
import { readConfig } from "@remix-run/core/config";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/core/server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the express adapter
jest.mock("@remix-run/core/server");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
  typeof createRemixRequestHandler
>;

// Since adapters call `readConfig` we just erase it for these tests, we aren't
// even running the real createRequestHandler, we're creating our own responses
// just so we can test that adapters interperet them correctly
jest.mock("@remix-run/core/config");
let mockedReadConfig = readConfig as jest.MockedFunction<typeof readConfig>;

describe("express createRequestHandler", () => {
  describe("basic requests", () => {
    // set up the express app
    let request: any;

    beforeEach(() => {
      mockedReadConfig.mockResolvedValue({} as ReturnType<typeof readConfig>);
      let app = express();
      app.all("*", createRequestHandler());
      request = supertest(app);
    });

    afterEach(() => {
      mockedCreateRequestHandler.mockReset();
      mockedReadConfig.mockReset();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("handles requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async req => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      let res = await request.get("/foo/bar");
      expect(res.status).toBe(200);
      expect(res.text).toBe("URL: /foo/bar");
      expect(res.headers["x-powered-by"]).toBe("Express");
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response("", { status: 204 });
      });

      let res = await request.get("/");
      expect(res.status).toBe(204);
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response("", {
          headers: { "x-time-of-year": "most wonderful" }
        });
      });

      let res = await request.get("/");
      expect(res.headers["x-time-of-year"]).toBe("most wonderful");
    });
  });
});
