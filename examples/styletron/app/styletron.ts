import { Client, Server } from "styletron-engine-atomic"; // or "styletron-engine-monolithic"

/**
 * The Styletron engine to use on the current runtime.
 */
export const styletron =
  typeof document === "undefined"
    ? new Server()
    : new Client({
        hydrate: getHydrateClass(),
    });

export function isStyletronClient(engine: typeof styletron): engine is Client
{
  return styletron instanceof Client;
}

export function isStyletronServer(engine: typeof styletron): engine is Server
{
  return styletron instanceof Server;
}

export function collectStyles(): string {
  if (!isStyletronServer(styletron)) {
    throw new Error("Can only collect styles during server-side rendering.");
  }

  return styletron.getStylesheetsHtml();
}

function getHydrateClass(): HTMLCollectionOf<HTMLStyleElement> {
  return document.getElementsByClassName(
    "_styletron_hydrate_"
  ) as HTMLCollectionOf<HTMLStyleElement>;
}
