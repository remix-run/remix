import type { ReactChildren } from "react";
import React from "react";
import type { Request, EntryContext } from "@remix-run/core";
import type { Location, To } from "history";
import { Action, createPath, parsePath } from "history";

import { RemixEntry } from "./internals";

function createLocation(url: string): Location {
  let path = parsePath(url);
  return {
    pathname: path.pathname || "/",
    search: path.search || "",
    hash: path.hash || "",
    state: null,
    key: "default"
  };
}

interface RemixServerProps {
  children: ReactChildren;
  context: EntryContext;
  request: Request;
}

export default function RemixServer({
  children,
  context,
  request
}: RemixServerProps) {
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
      children={children}
      action={Action.Pop}
      location={createLocation(request.url)}
      navigator={staticNavigator}
      static={true}
    />
  );
}
