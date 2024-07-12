import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ContentType } from "./content-type.js";

describe("ContentType", () => {
  it("parses initial value correctly", () => {
    let header = new ContentType("text/plain; charset=utf-8");
    assert.equal(header.mediaType, "text/plain");
    assert.equal(header.charset, "utf-8");
  });

  it("handles empty initial value", () => {
    let header = new ContentType("");
    assert.equal(header.mediaType, "");
    assert.equal(header.charset, undefined);
  });

  it("handles whitespace in initial value", () => {
    let header = new ContentType(" text/html ;  charset = iso-8859-1 ");
    assert.equal(header.mediaType, "text/html");
    assert.equal(header.charset, "iso-8859-1");
  });

  it("sets and gets media type", () => {
    let header = new ContentType("text/plain");
    header.mediaType = "application/json";
    assert.equal(header.mediaType, "application/json");
  });

  it("sets and gets charset", () => {
    let header = new ContentType("text/plain");
    header.charset = "utf-8";
    assert.equal(header.charset, "utf-8");
  });

  it("sets and gets boundary", () => {
    let header = new ContentType("multipart/form-data");
    header.boundary = "abc123";
    assert.equal(header.boundary, "abc123");
  });

  it("removes charset when set to null", () => {
    let header = new ContentType("text/plain; charset=utf-8");
    header.charset = null;
    assert.equal(header.charset, undefined);
  });

  it("removes boundary when set to null", () => {
    let header = new ContentType("multipart/form-data; boundary=abc123");
    header.boundary = null;
    assert.equal(header.boundary, undefined);
  });

  it("handles quoted attribute values", () => {
    let header = new ContentType('text/plain; charset="us-ascii"');
    assert.equal(header.charset, "us-ascii");
  });

  it("converts to string correctly", () => {
    let header = new ContentType("text/plain; charset=utf-8");
    assert.equal(header.toString(), "text/plain; charset=utf-8");
  });

  it("handles multiple attributes", () => {
    let header = new ContentType(
      'multipart/form-data; boundary="abc123"; charset=utf-8'
    );
    assert.equal(header.mediaType, "multipart/form-data");
    assert.equal(header.boundary, "abc123");
    assert.equal(header.charset, "utf-8");
  });

  it("preserves case for media type", () => {
    let header = new ContentType("Text/HTML");
    assert.equal(header.mediaType, "Text/HTML");
  });

  it("converts attribute names to lowercase", () => {
    let header = new ContentType("text/plain; CharSet=utf-8");
    assert.equal(header.charset, "utf-8");
  });

  it("handles attribute values with special characters", () => {
    let header = new ContentType(
      'multipart/form-data; boundary="---=_Part_0_1234567.89"'
    );
    assert.equal(header.boundary, "---=_Part_0_1234567.89");
  });

  it("correctly quotes attribute values in toString()", () => {
    let header = new ContentType("multipart/form-data");
    header.boundary = "abc 123";
    assert.equal(header.toString(), 'multipart/form-data; boundary="abc 123"');
  });

  it("handles empty attribute values", () => {
    let header = new ContentType("text/plain; charset=");
    assert.equal(header.charset, "");
  });

  it("ignores attributes without values", () => {
    let header = new ContentType("text/plain; charset");
    assert.equal(header.charset, undefined);
  });

  it("preserves order of attributes in toString()", () => {
    let header = new ContentType(
      "multipart/form-data; charset=utf-8; boundary=abc123"
    );
    assert.equal(
      header.toString(),
      "multipart/form-data; charset=utf-8; boundary=abc123"
    );
  });
});
