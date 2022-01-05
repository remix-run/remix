import type {LoaderFunction} from "remix";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "remix";
import { getSession, commitSession } from "./services/session.server";

type LoaderData = {
  authError: string | null
}

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request)
  const authError = session.get('auth:error') ?? null
  return json<LoaderData>(
    {
      authError,
    },
    {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    }
  )
}

export default function App() {
  const { authError } = useLoaderData<LoaderData>()
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {authError && (<p>{authError}</p>)}
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
