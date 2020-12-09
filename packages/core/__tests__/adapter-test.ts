import type { RemixConfig } from "../config";
import { Request, Response } from "../fetch";
import { createAdapter } from "../adapter";
import { createSession, createSessionFacade } from "../sessions";

import { readConfig } from "../config";
import { createRemixRequestHandler } from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetter tests do), we just want to test createAdapter
jest.mock("../server");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
  typeof createRemixRequestHandler
>;

// Since adapters call `readConfig` we just erase it for these tests, we aren't
// even running the real createRequestHandler, we're creating our own responses
// just so we can test that adapters interperet them correctly
jest.mock("../config");
let mockedReadConfig = readConfig as jest.MockedFunction<typeof readConfig>;

// just return an empty object when readConfig is called
mockedReadConfig.mockResolvedValue(({} as unknown) as RemixConfig);

describe("createAdapter", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Our test adapter. This illustrates the three methods that a deployment
  // adapter needs to implement to run a remix app
  let adapter = createAdapter({
    createRemixRequest(fakePlatformReq) {
      return new Request(fakePlatformReq.url);
    },

    createRemixSession(enableSessions, fakePlatformReq) {
      return enableSessions
        ? createSession(fakePlatformReq.session)
        : createSessionFacade("Error when trying to use session message");
    },

    // patterned this one off of Azure since it's probably the weirdest with the
    // context mutation
    async sendPlatformResponse(remixResponse, _, fakePlatFormContext) {
      Object.assign(fakePlatFormContext, {
        status: remixResponse.status,
        body: await remixResponse.text()
      });

      // even though this test adapter depends on mutation, we return the value
      // here to test that createAdapter returns the value out of this method
      return fakePlatFormContext;
    }
  });

  it("interperets requests and responses through the adapter", async () => {
    // force createRequestHandler to send the response we want, in actual remix
    // this would match against the routes in the remix config, call loaders,
    // etc. but we don't care about all that here, just that the fake adapter's
    // req/res get interpereted correctly.
    mockedCreateRequestHandler.mockImplementation(() => async request => {
      return new Response(`URL you gave me was ${request.url}`, {
        status: 200
      });
    });

    // like `app.all("*", adapter())` in express
    let handler = adapter();

    // our fake platform request
    let fakeRequest = { url: "https://example.com/foo/bar", session: {} };

    // our fake platform response, we expect this to get mutated if
    // createAdapter did everything we need it to.
    let fakeResponse = {};

    let returnedResponse = await handler(fakeRequest, fakeResponse);

    expect(fakeResponse).toMatchInlineSnapshot(`
      Object {
        "body": "URL you gave me was https://example.com/foo/bar",
        "status": 200,
      }
    `);

    expect(returnedResponse).toBe(fakeResponse);
  });

  it("creates remix sessions", async () => {
    mockedCreateRequestHandler.mockImplementation(() => async (_, session) => {
      return new Response(`session foo:${session.get("foo")}`, {
        status: 200
      });
    });

    let handler = adapter();
    let req = { url: "", session: { foo: "bar" } };
    let res = {};

    // simulate a request coming in
    await handler(req, res);

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": "session foo:bar",
        "status": 200,
      }
    `);
  });

  it("uses getLoadContext", async () => {
    mockedCreateRequestHandler.mockImplementation(
      () => async (_, __, loadContext) => {
        // assert getLoadContext makes it way to the remix server
        return new Response(`loadContext:${loadContext}`, {
          status: 200
        });
      }
    );
    let fakeReq = { url: "" };
    let fakeRes = {};

    expect.assertions(3);

    let handler = adapter({
      getLoadContext(req, res) {
        // assert that the platform args get passed into getLoadContext
        expect(req).toBe(fakeReq);
        expect(res).toBe(fakeRes);
        return "💥";
      }
    });

    await handler(fakeReq, fakeRes);

    expect(fakeRes).toMatchInlineSnapshot(`
      Object {
        "body": "loadContext:💥",
        "status": 200,
      }
    `);
  });

  it("Exits when it can't read the config with custom message in the console", async () => {
    // get readConfig to throw
    mockedReadConfig.mockImplementation(async () => {
      throw new Error("🧨");
    });

    // prevent the process from ACTUALLY exiting
    const mockExit = jest
      .spyOn(process, "exit")
      // @ts-ignore it wants a "never" instead of a "void", but the whole point is
      // to not actually exit!
      .mockImplementation(() => {});

    // Jest fails on console.error, so just erase it, then assert it was called
    const mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let handler = adapter();

    // call the handler to trigger the error
    await handler({ url: "" }, {});

    // got the messages in the console
    expect(mockConsoleError).toHaveBeenCalledTimes(2);
    // exited with `1`
    expect(mockExit).toHaveBeenCalledWith(1);

    // don't screw up other tests
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });
});
