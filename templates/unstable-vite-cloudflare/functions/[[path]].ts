import { type ServerBuild } from "@remix-run/cloudflare";
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";

const build = async (): Promise<ServerBuild> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // eslint-disable-next-line import/no-unresolved
  return import("../build/server");
};

export const onRequest = createPagesFunctionHandler({
  build,
  getLoadContext: (context) => ({ env: context.env }),
});
