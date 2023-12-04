import { extractPluginConfig } from "./extract-plugin-config";

export interface ViteDevOptions {
  config?: string;
  port?: number;
  strictPort?: boolean;
  host?: string;
  force?: boolean;
}

export async function dev(
  root: string,
  { config: configFile, force, host, port, strictPort }: ViteDevOptions
) {
  // For now we just use this function to validate that the Vite config is
  // targeting Remix, but in the future the return value can be used to
  // configure the entire multi-step build process.
  await extractPluginConfig({
    root,
    configFile,
    mode: "development",
  });

  let vite = await import("vite");
  let server = await vite.createServer({
    configFile,
    optimizeDeps: { force },
    server: { host, port, strictPort },
  });

  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}
