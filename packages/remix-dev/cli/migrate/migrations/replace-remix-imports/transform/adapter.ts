const adapters = [
  "architect",
  "cloudflare-pages",
  "cloudflare-workers",
  "express",
  "netlify",
  "vercel",
] as const;
export type Adapter = typeof adapters[number];
export const isAdapter = (maybe: string): maybe is Adapter => {
  return (adapters as readonly string[]).includes(maybe);
};
