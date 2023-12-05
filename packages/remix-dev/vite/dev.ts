import type * as Vite from "vite";

import { extractPluginConfig } from "./extract-plugin-config";

export interface ViteDevOptions {
  clearScreen?: boolean;
  config?: string;
  cors?: boolean;
  force?: boolean;
  host?: boolean | string;
  logLevel?: Vite.LogLevel;
  mode?: string;
  open?: boolean | string;
  port?: number;
  strictPort?: boolean;
}

export async function dev(
  root: string,
  {
    clearScreen,
    config: configFile,
    cors,
    force,
    host,
    logLevel,
    mode,
    open,
    port,
    strictPort,
  }: ViteDevOptions
) {
  // For now we just use this function to validate that the Vite config is
  // targeting Remix, but in the future the return value can be used to
  // configure the entire multi-step build process.
  await extractPluginConfig({
    command: "serve",
    configFile,
    mode,
    root,
  });

  let vite = await import("vite");
  let server = await vite.createServer({
    clearScreen,
    configFile,
    logLevel,
    mode,
    optimizeDeps: { force },
    server: { open, cors, host, port, strictPort },
  });

  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}
