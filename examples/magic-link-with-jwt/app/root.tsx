import React, { useEffect } from "react";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "remix";
import type {
  LoaderFunction,
  MetaFunction,
  LinksFunction,
  ActionFunction,
} from "remix";
import bootstrap from "bootstrap/dist/css/bootstrap.min.css";
import { Container } from "react-bootstrap";
import { useUserContext } from "~/lib/useUserContext";
import type { MagicUserMetadata } from "@magic-sdk/admin";
import { getUserSessionMetadata, logout } from "~/lib/cookies.server";
import { Header } from "~/components/layout/Header";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: bootstrap }];
};

export const meta: MetaFunction = () => {
  return { title: "New Remix App" };
};

export const loader: LoaderFunction = async ({ request }) => {
  return await getUserSessionMetadata(request);
};

export const action: ActionFunction = async ({ request }) => {
  const actionType = (await request.formData()).get("actionType");
  if (actionType === "logout") {
    return await logout(request);
  }
};

const App = (): JSX.Element => {
  const loaderData = useLoaderData<MagicUserMetadata>();
  const [, setUser] = useUserContext();

  useEffect(() => {
    if (setUser) {
      setUser((prevState) => ({ ...prevState, loading: true }));
      if (loaderData) {
        setUser((prevState) => ({
          ...prevState,
          user: { ...loaderData },
          loading: false,
        }));
      } else {
        setUser((prevState) => ({ ...prevState, loading: false }));
      }
    }
  }, [loaderData, setUser]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <title>Magic Link with JWT</title>
      </head>
      <body>
        <Header />
        <Container>
          <Outlet />
        </Container>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
};

export default App;
