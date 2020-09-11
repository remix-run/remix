import type { ReactChildren } from "react";
import React from "react";
import type { Request, RemixContext } from "@remix-run/core";
import { StaticRouter } from "react-router-dom/server";

import { RemixEntryProvider } from "./index";

interface RemixServerProps {
  request: Request;
  context: RemixContext;
  children: ReactChildren;
}

export default function Remix({
  request,
  context,
  children
}: RemixServerProps) {
  return (
    <StaticRouter location={request.url}>
      <RemixEntryProvider context={context} children={children} />
    </StaticRouter>
  );
}
