import type { ReactChildren } from "react";
import React from "react";
import { StaticRouter } from "react-router-dom/server";
import type { Request, EntryContext } from "@remix-run/core";

import { RemixEntry } from "./index";

interface RemixServerProps {
  request: Request;
  context: EntryContext;
  children: ReactChildren;
}

export default function RemixServer({
  request,
  context,
  children
}: RemixServerProps) {
  return (
    <StaticRouter location={request.url}>
      <RemixEntry context={context} children={children} />
    </StaticRouter>
  );
}
