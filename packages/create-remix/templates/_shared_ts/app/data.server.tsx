/**
 * In a real app, you could use this function to fetch data from a database or
 * external service. You can call a function like this in your route's loader or
 * action function and Remix will exclude them from your client bundle!
 *
 * https://docs.remix.run/v0.21/tutorial/3-loading-data/
 */
export async function getRemixResources(): Promise<Array<RemixResource>> {
  return await Promise.resolve([
    {
      id: 0,
      name: "Remix Docs",
      url: "https://docs.remix.run"
    },
    {
      id: 1,
      name: "React Router Docs",
      url: "reactrouter.com/docs"
    },
    {
      id: 2,
      name: "Remix Discord",
      url: "https://discord.gg/VBePs6d"
    }
  ]);
}

export interface RemixResource {
  id: number;
  name: string;
  url: string;
}
