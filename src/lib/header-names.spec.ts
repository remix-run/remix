import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeHeaderName } from "./header-names.js";

describe("normalizeHeaderName", () => {
  it("handles common headers correctly", () => {
    assert.equal(normalizeHeaderName("content-type"), "Content-Type");
    assert.equal(normalizeHeaderName("content-length"), "Content-Length");
    assert.equal(normalizeHeaderName("user-agent"), "User-Agent");
    assert.equal(normalizeHeaderName("accept"), "Accept");
  });

  it("handles special case headers correctly", () => {
    assert.equal(normalizeHeaderName("etag"), "ETag");
    assert.equal(normalizeHeaderName("www-authenticate"), "WWW-Authenticate");
    assert.equal(normalizeHeaderName("x-forwarded-for"), "X-Forwarded-For");
    assert.equal(normalizeHeaderName("x-xss-protection"), "X-XSS-Protection");
    assert.equal(normalizeHeaderName("te"), "TE");
    assert.equal(normalizeHeaderName("expect-ct"), "Expect-CT");
  });

  it("normalizes mixed-case input", () => {
    assert.equal(normalizeHeaderName("CoNtEnT-TyPe"), "Content-Type");
    assert.equal(normalizeHeaderName("x-FoRwArDeD-fOr"), "X-Forwarded-For");
  });

  it("handles single-word headers", () => {
    assert.equal(normalizeHeaderName("authorization"), "Authorization");
    assert.equal(normalizeHeaderName("host"), "Host");
  });

  it("normalizes other common HTTP headers", () => {
    assert.equal(normalizeHeaderName("accept-charset"), "Accept-Charset");
    assert.equal(normalizeHeaderName("accept-encoding"), "Accept-Encoding");
    assert.equal(normalizeHeaderName("accept-language"), "Accept-Language");
    assert.equal(normalizeHeaderName("cache-control"), "Cache-Control");
    assert.equal(normalizeHeaderName("connection"), "Connection");
    assert.equal(normalizeHeaderName("cookie"), "Cookie");
    assert.equal(normalizeHeaderName("date"), "Date");
    assert.equal(normalizeHeaderName("expect"), "Expect");
    assert.equal(normalizeHeaderName("forwarded"), "Forwarded");
    assert.equal(normalizeHeaderName("from"), "From");
    assert.equal(normalizeHeaderName("if-match"), "If-Match");
    assert.equal(normalizeHeaderName("if-modified-since"), "If-Modified-Since");
    assert.equal(normalizeHeaderName("if-none-match"), "If-None-Match");
    assert.equal(normalizeHeaderName("if-range"), "If-Range");
    assert.equal(
      normalizeHeaderName("if-unmodified-since"),
      "If-Unmodified-Since"
    );
    assert.equal(normalizeHeaderName("max-forwards"), "Max-Forwards");
    assert.equal(normalizeHeaderName("origin"), "Origin");
    assert.equal(normalizeHeaderName("pragma"), "Pragma");
    assert.equal(
      normalizeHeaderName("proxy-authorization"),
      "Proxy-Authorization"
    );
    assert.equal(normalizeHeaderName("range"), "Range");
    assert.equal(normalizeHeaderName("referer"), "Referer");
    assert.equal(normalizeHeaderName("server"), "Server");
    assert.equal(normalizeHeaderName("transfer-encoding"), "Transfer-Encoding");
    assert.equal(normalizeHeaderName("upgrade"), "Upgrade");
    assert.equal(normalizeHeaderName("via"), "Via");
    assert.equal(normalizeHeaderName("warning"), "Warning");
    assert.equal(normalizeHeaderName("alt-svc"), "Alt-Svc");
    assert.equal(
      normalizeHeaderName("content-disposition"),
      "Content-Disposition"
    );
    assert.equal(normalizeHeaderName("content-encoding"), "Content-Encoding");
    assert.equal(normalizeHeaderName("content-language"), "Content-Language");
    assert.equal(normalizeHeaderName("content-location"), "Content-Location");
    assert.equal(normalizeHeaderName("content-range"), "Content-Range");
    assert.equal(normalizeHeaderName("link"), "Link");
    assert.equal(normalizeHeaderName("location"), "Location");
    assert.equal(normalizeHeaderName("retry-after"), "Retry-After");
    assert.equal(
      normalizeHeaderName("strict-transport-security"),
      "Strict-Transport-Security"
    );
    assert.equal(normalizeHeaderName("vary"), "Vary");
  });

  it("handles custom X- headers", () => {
    assert.equal(normalizeHeaderName("x-custom-header"), "X-Custom-Header");
    assert.equal(normalizeHeaderName("x-requested-with"), "X-Requested-With");
  });

  it("preserves casing for unknown acronyms", () => {
    assert.equal(normalizeHeaderName("x-csrf-token"), "X-Csrf-Token");
    assert.equal(normalizeHeaderName("x-api-key"), "X-Api-Key");
  });
});
