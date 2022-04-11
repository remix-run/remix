export const runtimes = ["cloudflare", "node"] as const;
export type Runtime = typeof runtimes[number];
export const isRuntime = (maybe: string): maybe is Runtime => {
  return (runtimes as readonly string[]).includes(maybe);
};
