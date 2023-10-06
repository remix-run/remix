import { spawn } from "cross-spawn";
import resolveBin from "resolve-bin";

export interface ViteDevOptions {
  config?: string;
  port?: string;
  strictPort?: boolean;
  host?: true | string;
  force?: boolean;
}

export async function dev({
  config,
  port,
  strictPort,
  host,
  force,
}: ViteDevOptions) {
  let viteBin = resolveBin.sync("vite");

  spawn(
    "node",
    [
      viteBin,
      "dev",
      ...(config ? ["--config", config] : []),
      ...(port ? ["--port", port] : []),
      ...(strictPort ? ["--strictPort"] : []),
      ...(force ? ["--force"] : []),
      ...(host ? ["--host", ...(typeof host === "string" ? [host] : [])] : []),
    ],
    {
      shell: true,
      stdio: "inherit",
      env: {
        ...process.env,
      },
    }
  );

  await new Promise(() => {});
}
