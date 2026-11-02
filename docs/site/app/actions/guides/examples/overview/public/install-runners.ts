// Commands for scaffolding and starting a new app, one script per package manager.
export type InstallRunner = {
  value: string;
  label: string;
  script: string;
};

export function createInstallRunners(projectDirectory: string): InstallRunner[] {
  return [
    {
      value: "npm",
      label: "npm",
      script: `npx remix new ${projectDirectory}\ncd ${projectDirectory}\nnpm install\nnpm run dev`,
    },
    {
      value: "pnpm",
      label: "pnpm",
      script: `pnpm dlx remix new ${projectDirectory}\ncd ${projectDirectory}\npnpm install\npnpm dev`,
    },
    {
      value: "yarn",
      label: "Yarn",
      script: `yarn dlx remix new ${projectDirectory}\ncd ${projectDirectory}\nyarn install\nyarn dev`,
    },
    {
      value: "bun",
      label: "Bun",
      script: `bunx remix new ${projectDirectory}\ncd ${projectDirectory}\nbun install\nbun run dev`,
    },
    {
      value: "deno",
      label: "Deno",
      script: `deno run -A npm:remix new ${projectDirectory}\ncd ${projectDirectory}\ndeno install\ndeno task dev`,
    },
  ];
}
