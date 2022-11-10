import { createRequestHandler as createRemixRequestHandler } from "@remix-run/express";
import * as path from "path";
import supertest from "supertest";

import { createApp } from "../index";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test if serve properly uses express
jest.mock("@remix-run/express", () => {
  let original = jest.requireActual("@remix-run/express");
  return {
    ...original,
    createRequestHandler: jest.fn(),
  };
});

let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

describe("createApp", () => {
  beforeEach(() => {
    mockedCreateRequestHandler.mockImplementation(
      () => async (req, resp, _next) => {
        resp.status(200).send(`Remix Handled: ${req.url}`);
        resp.end();
      }
    );
  });

  afterEach(() => {
    mockedCreateRequestHandler.mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("serves static content found in assetsBuildDirectory with the publicPath prefix", async () => {
    let publicPath = "a-public-path";
    let assetsBuildDirectory = path.join(
      __dirname,
      "../../templates/express/public"
    );

    let request = supertest(
      createApp("./", "dev", publicPath, assetsBuildDirectory)
    );
    let res = await request.get("/a-public-path/favicon.ico");

    expect(res.status).toBe(200);
  });

  it("serves static content found in publicAssetsDirectory", async () => {
    let publicAssetsDirectory = path.join(
      __dirname,
      "../../templates/express/public"
    );

    let request = supertest(
      createApp("./", "dev", "/foo", "/tmp/bar", publicAssetsDirectory)
    );
    let res = await request.get("/favicon.ico");

    expect(res.status).toBe(200);
  });
});
