import type { LoaderFunction } from "remix";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "remix";

export const loader: LoaderFunction = () => {
  return {
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY
    }
  };
};

export default function App() {
  const { env } = useLoaderData<Window>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.env = ${JSON.stringify(env)}`
          }}
        />
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
