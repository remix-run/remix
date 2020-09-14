import type { ReactChildren } from "react";
import React from "react";
// TODO: Export RouteObject from 'react-router-dom'
import type { RouteObject } from "react-router";
import { useRoutes } from "react-router-dom";
import type { RemixContext as RemixContextType } from "@remix-run/core";

const RemixContext = React.createContext<RemixContextType | undefined>(
  undefined
);

function useRemixContext(): RemixContextType {
  let context = React.useContext(RemixContext);

  if (!context) {
    // TODO: Nicer error message
    throw new Error("You must render this element in a <Remix> component");
  }

  return context;
}

export function RemixEntryProvider({
  context,
  children
}: {
  context: RemixContextType;
  children: ReactChildren;
}) {
  return (
    <RemixContext.Provider value={context}>{children}</RemixContext.Provider>
  );
}

export function RemixRoute({ id }: { id: string }) {
  let context = useRemixContext();
  let mod = context.requireRoute(id);
  return <mod.default />;
}

export function Routes() {
  let context = useRemixContext();

  let route = context.matches.reduceRight<RouteObject | null>(
    (childRoute, match) => {
      // TODO: Make caseSensitive optional in RouteObject type in RR
      let route: RouteObject = {
        caseSensitive: false,
        path: match.route.path,
        element: <RemixRoute id={match.route.id} />,
        preload() {
          // TODO
        }
      };

      if (childRoute) {
        route.children = [childRoute];
      }

      return route;
    },
    null
  );

  return useRoutes([route!]);
}

export function Meta() {
  return null;
}

export function Scripts() {
  return null;
}

export function Styles() {
  return null;
}

export function Link() {
  return <a href="#">link</a>;
}
