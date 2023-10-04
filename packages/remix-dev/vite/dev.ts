import { spawn } from "node:child_process";

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
  spawn(
    "vite",
    [
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
