import React from "react";
import { create as createTestRenderer } from "react-test-renderer";
import { RemixLink } from "@remix-run/react";

describe("A <RemixLink>", () => {
  it("works", () => {
    let renderer = createTestRenderer(<RemixLink />);
    expect(renderer.toJSON()).toMatchInlineSnapshot(`
      <a
        href="#"
      >
        link
      </a>
    `);
  });
});
