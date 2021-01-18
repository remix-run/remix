import type { Location, To } from "history";
import { Action, createPath } from "history";
import type { ReactElement } from "react";
import React from "react";
import type { EntryContext } from "@remix-run/core";

import { RemixEntry } from "./components";

export interface RemixServerProps {
  context: EntryContext;
  url: string | URL;
}

/**
 * The entry point for a Remix app when it is rendered on the server (in
 * `entry-server.js`). This component is used to generate the HTML in the
 * response from the server.
 */
export default function RemixServer({
  context,
  url
}: RemixServerProps): ReactElement {
  if (typeof url === "string") {
    url = new URL(url);
  }

  let location: Location = {
    pathname: url.pathname,
    search: url.search,
    hash: "",
    state: null,
    key: "default"
  };

  let staticNavigator = {
    createHref(to: To) {
      return typeof to === "string" ? to : createPath(to);
    },
    push(to: To) {
      throw new Error(
        `You cannot use navigator.push() on the server because it is a stateless ` +
          `environment. This error was probably triggered when you did a ` +
          `\`navigate(${JSON.stringify(to)})\` somewhere in your app.`
      );
    },
    replace(to: To) {
      throw new Error(
        `You cannot use navigator.replace() on the server because it is a stateless ` +
          `environment. This error was probably triggered when you did a ` +
          `\`navigate(${JSON.stringify(to)}, { replace: true })\` somewhere ` +
          `in your app.`
      );
    },
    go(delta: number) {
      throw new Error(
        `You cannot use navigator.go() on the server because it is a stateless ` +
          `environment. This error was probably triggered when you did a ` +
          `\`navigate(${delta})\` somewhere in your app.`
      );
    },
    back() {
      throw new Error(
        `You cannot use navigator.back() on the server because it is a stateless ` +
          `environment.`
      );
    },
    forward() {
      throw new Error(
        `You cannot use navigator.forward() on the server because it is a stateless ` +
          `environment.`
      );
    },
    block() {
      throw new Error(
        `You cannot use navigator.block() on the server because it is a stateless ` +
          `environment.`
      );
    }
  };

  return (
    <RemixEntry
      context={context}
      action={Action.Pop}
      location={location}
      navigator={staticNavigator}
      static={true}
    />
  );
}
