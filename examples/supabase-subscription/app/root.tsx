import { createClient } from "@supabase/supabase-js";
import { Provider } from "react-supabase";
import type { MetaFunction, LoaderFunction } from "remix";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "remix";

type LoaderData = {
  ENV: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  };
};
export const loader: LoaderFunction = async () => {
  return json<LoaderData>({
    ENV: {
      SUPABASE_URL: process.env.SUPABASE_URL as string,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string,
    },
  });
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  const data = useLoaderData();
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {data ? (
          <Provider
            value={createClient(
              data.ENV.SUPABASE_URL,
              data.ENV.SUPABASE_ANON_KEY
            )}
          >
            <Outlet />
          </Provider>
        ) : null}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
