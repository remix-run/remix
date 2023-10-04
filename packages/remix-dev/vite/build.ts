import * as vite from "vite";

export interface ViteBuildOptions {
  config?: string;
  force?: boolean;
}

export async function build({ config: configFile, force }: ViteBuildOptions) {
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
