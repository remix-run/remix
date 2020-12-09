import express from "express";
import supertest from "supertest";

// @ts-ignore Adding @types/express-session breaks the build of
// @remix-run/core.assetServer, because `app.get("*", handleRequest)` wants a
// request type with session, but assetServer imports the non-augmented types,
// and since our node_modules are shared at the root of the project, we either
// have to tell the asset server it's got a req.session, or just ignore this and
// not install @types/express-session so it doesn't do weird things to `app.get`.
import session from "express-session";

import { createRequestHandler as adapter } from "../index";

import { Response } from "@remix-run/core/fetch";
import { readConfig } from "@remix-run/core/config";
import { createRemixRequestHandler } from "@remix-run/core/server";

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
  beforeEach(() => {
    // @ts-ignore it doesn't, we mock the request handler and never use the config
    mockedReadConfig.mockResolvedValue({});
  });

  afterEach(() => {
    mockedCreateRequestHandler.mockReset();
    mockedReadConfig.mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("basic requests", () => {
    // set up the express app
    let app = express();
    app.all("*", adapter({ enableSessions: false }));
    let request = supertest(app);

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

  describe("sessions", () => {
    it("sets and gets values from a cookie session", async () => {
      let cookie = "";
      let app = express();
      app.use(
        session({
          secret: "remix",
          resave: false,
          saveUninitialized: false
        })
      );
      app.all("*", adapter());
      let request = supertest(app);

      mockedCreateRequestHandler.mockImplementation(
        () => async (req, session) => {
          if (req.url.endsWith("/set")) {
            session.set("foo", "🍪");
            return new Response("Set");
          } else if (req.url.endsWith("/get")) {
            return new Response(`Session: ${session.get("foo")}`);
          } else if (req.url.endsWith("/destroy")) {
            await session.destroy();
            return new Response(`Session destroyed`);
          } else {
            throw new Error("unknown test url");
          }
        }
      );

      let setRes = await request.get("/set");
      expect(setRes.headers["set-cookie"]).toBeDefined();
      cookie = setRes.headers["set-cookie"].pop().split(";")[0];

      let getRes = await request.get("/get").set("Cookie", cookie);
      expect(getRes.text).toBe("Session: 🍪");

      // TODO: Test destroying
      // For some reason the "set-cookie" header doesn't come back on the
      // `getRes`. I think it's something to do with supertest making a new
      // server for pretty much every request, might need to figure out how to
      // get it to be the same server across requests. I know it works over in
      // the fixtures, so just marking as a todo for now. Already wasted a
      // couple hours here, so I'm moving on. -ryan

      // This shouldn't be empty but it is!
      // console.log({ getResCookie: getRes.headers["set-cookie"] })

      // This will pass, but that's only because every request after the first
      // doesn't set a cookie anyway :(
      // let destroyRes = await request.get("/destroy").set("Cookie", cookie);
      // expect(destroyRes.headers["set-cookie"]).toBeUndefined();
    });
  });
});
