import type { LinksFunction, LoaderFunction } from "remix";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useCatch,
  useLoaderData
} from "remix";

import global from "~/dist/styles/global.css";
import type { User } from "./models";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: global }];
};

interface LoaderData {
  ENV: Exclude<Window["ENV"], undefined>;
}

export const loader: LoaderFunction = async ({ request }) => {
  const data: LoaderData = {
    ENV: {
      SITE_URL: process.env.SITE_URL
    }
  };

  return data;
};

function Document({
  children,
  title,
  ENV = {}
}: {
  children: React.ReactNode;
  title?: string;
  ENV?: Record<any, any>;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        {title ? <title>{title}</title> : null}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`
          }}
        />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  const { ENV } = useLoaderData<{
    user: User | null;
    ENV: {
      SITE_URL: string;
    };
  }>();

  return (
    <Document ENV={ENV}>
      <Outlet />
    </Document>
  );
}

export function CatchBoundary() {
  const caught = useCatch();

  switch (caught.status) {
    case 401:
    case 404:
      return (
        <Document title={`${caught.status} ${caught.statusText}`}>
          <h1>
            {caught.status} {caught.statusText}
          </h1>
        </Document>
      );

    default:
      throw new Error(
        `Unexpected caught response with status: ${caught.status}`
      );
  }
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return (
    <Document title="Uh-oh!">
      <h1>App Error</h1>
      <pre>{error.message}</pre>
      <p>
        Replace this UI with what you want users to see when your app throws
        uncaught errors.
      </p>
    </Document>
  );
}
