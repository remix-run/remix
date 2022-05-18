import lambdaTester from "lambda-tester";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2
} from "aws-lambda";
import {
  createRequestHandler as createRemixRequestHandler
} from "@remix-run/node";

import { createRequestHandler } from "../server";
import * as v1Methods from "../api/v1";
import * as v2Methods from "../api/v2";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the architect adapter
jest.mock("@remix-run/node", () => {
  let original = jest.requireActual("@remix-run/node");
  return {
    ...original,
    createRequestHandler: jest.fn(),
  };
});
let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

function createMockEvent(event: Partial<APIGatewayProxyEvent | APIGatewayProxyEventV2> = {}) {
  let now = new Date();
  return {
    headers: {
      host: "localhost:3333",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate",
      ...event.headers,
    },
    isBase64Encoded: false,
    rawPath: "/",
    rawQueryString: "",
    requestContext: {
      http: {
        method: "GET",
        path: "/",
        protocol: "HTTP/1.1",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
        sourceIp: "127.0.0.1",
        ...event.requestContext?.http,
      },
      routeKey: "ANY /{proxy+}",
      accountId: "accountId",
      requestId: "requestId",
      apiId: "apiId",
      domainName: "id.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "id",
      stage: "test",
      time: now.toISOString(),
      timeEpoch: now.getTime(),
      ...event.requestContext,
    },
    routeKey: "foo",
    version: "2.0",
    ...event,
  };
}

describe("architect createRequestHandler", () => {
  describe("basic requests", () => {
    afterEach(() => {
      mockedCreateRequestHandler.mockReset();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("handles requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: /foo/bar");
        });
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
        });
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 204 });
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(204);
        });
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        let headers = new Headers();
        headers.append("X-Time-Of-Year", "most wonderful");
        headers.append(
          "Set-Cookie",
          "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        headers.append(
          "Set-Cookie",
          "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        headers.append(
          "Set-Cookie",
          "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
        );

        return new Response(null, { headers });
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["x-time-of-year"]).toBe("most wonderful");
          expect(res.cookies).toEqual([
            "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
            "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
            "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax",
          ]);
        });
    });

    it("should call api v2 methods", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      const spyCreateRemixRequest = jest.spyOn(v2Methods, "createRemixRequest")
      const spySendRemixResponse = jest.spyOn(v2Methods, "sendRemixResponse")

      const mockEvent = createMockEvent({ rawPath: "/foo/bar" });

      await lambdaTester(createRequestHandler({ build: undefined, apiGatewayVersion: "v2" } as any))
        .event(mockEvent)
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: /foo/bar");
        });

      expect(spyCreateRemixRequest).toHaveBeenCalledWith(mockEvent)
      expect(spySendRemixResponse).toHaveBeenCalled()
    });

    it("should call api v1 methods", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      const spyCreateRemixRequest = jest.spyOn(v1Methods, "createRemixRequest")
      const spySendRemixResponse = jest.spyOn(v1Methods, "sendRemixResponse")

      const mockEvent = createMockEvent({ path: "/foo/bar" });

      await lambdaTester(createRequestHandler({ build: undefined, apiGatewayVersion: "v1" } as any))
        .event(mockEvent)
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: /foo/bar");
        });

      expect(spyCreateRemixRequest).toHaveBeenCalledWith(mockEvent)
      expect(spySendRemixResponse).toHaveBeenCalled()
    });
  });
});