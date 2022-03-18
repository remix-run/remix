import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "remix";
import { createClient } from "@supabase/supabase-js";
import { Provider } from "react-supabase";
type loaderData = {
  ENV: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  };
};
export const loader = async (): Promise<loaderData> => {
  return {
    ENV: {
      SUPABASE_URL: process.env.SUPABASE_URL as string,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string
    }
  };
};
export default function App() {
  const data = useLoaderData();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {data && (
          <Provider
            value={createClient(
              data.ENV.SUPABASE_URL,
              data.ENV.SUPABASE_ANON_KEY
            )}
          >
            <Outlet />
          </Provider>
        )}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
