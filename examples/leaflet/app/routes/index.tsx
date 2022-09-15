import type { LinksFunction } from "@remix-run/node";
import { ClientOnly } from "~/components/client-only";
import { Map } from "~/components/map.client";

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://unpkg.com/leaflet@1.8.0/dist/leaflet.css",
  },
];

export default function Index() {
  const mapHeight = "400px";

  return (
    <ClientOnly
      fallback={
        <div
          id="skeleton"
          style={{ height: mapHeight, background: "#d1d1d1" }}
        />
      }
    >
      {() => <Map height={mapHeight} />}
    </ClientOnly>
  );
}
