import { type ServerBuild } from "@remix-run/cloudflare";
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
// eslint-disable-next-line import/no-unresolved
import * as _build from "../build/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const build: ServerBuild = _build as any;

export const onRequest = createPagesFunctionHandler({
  build,
  getLoadContext: (context) => ({ env: context.env }),
  mode: build.mode,
});
