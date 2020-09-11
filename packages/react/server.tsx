import React from "react";
import type { Request, RemixContext } from "@remix-run/core";

import { EntryProvider } from "./index";

interface RemixServerProps {
  request: Request;
  context: RemixContext;
}

export default function Remix({ request, context }: RemixServerProps) {
  return <div>Hello from Remix</div>;
}
