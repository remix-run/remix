import * as React from "react";
import { render } from "@testing-library/react";

import type { LiveReload as ActualLiveReload } from "../components";
import "@testing-library/jest-dom/extend-expect";

describe("<LiveReload />", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("non-development environment", () => {
    let LiveReload: typeof ActualLiveReload;
    beforeEach(() => {
      process.env.NODE_ENV = "not-development";
      jest.resetModules();
      LiveReload = require("../components").LiveReload;
    });

    it("does nothing if the NODE_ENV is not development", () => {
      const { container } = render(<LiveReload />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("development environment", () => {
    let LiveReload: typeof ActualLiveReload;
    beforeEach(() => {
      process.env.NODE_ENV = "development";
      jest.resetModules();
      LiveReload = require("../components").LiveReload;
    });

    it("defaults the port to 8002", () => {
      const { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        /ws:\/\/localhost:8002\//
      );
    });

    it("can set the port explicitely", () => {
      const { container } = render(<LiveReload port={4321} />);
      expect(container.querySelector("script")).toHaveTextContent(
        /ws:\/\/localhost:4321\//
      );
    });

    it("determines the right port based on REMIX_DEV_SERVER_WS_PORT env variable", () => {
      process.env.REMIX_DEV_SERVER_WS_PORT = "1234";
      const { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        /ws:\/\/localhost:1234\//
      );
    });
  });
});
