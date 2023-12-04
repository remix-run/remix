import { extractPluginConfig } from "./extract-plugin-config";

export interface ViteBuildOptions {
  config?: string;
  force?: boolean;
}

export async function build(
  root: string,
  { config: configFile, force }: ViteBuildOptions
) {
  // For now we just use this function to validate that the Vite config is
  // targeting Remix, but in the future the return value can be used to
  // configure the entire multi-step build process.
  await extractPluginConfig({
    root,
    configFile,
    mode: "production",
  });

  let vite = await import("vite");

  async function viteBuild({ ssr }: { ssr: boolean }) {
    await vite.build({
      configFile,
      build: { ssr },
      optimizeDeps: { force },
    });
  }

  await viteBuild({ ssr: false });
  await viteBuild({ ssr: true });
}
