import * as React from 'react'
import {
  Links,
  LinksFunction,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from "remix";
import { ApolloContext } from './context/apollo';

import styles from '~/styles/index.css';

export const links: LinksFunction = () => {
  return [{ href: styles, rel: 'stylesheet' }];
};

export default function App() {
  const initialState = React.useContext(ApolloContext);
  const data = JSON.stringify(initialState).replace(/</g, '\\u003c');
  const html = `window.__APOLLO_STATE__=${data}`;

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
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
        <script dangerouslySetInnerHTML={{ __html: html }} />
      </body>
    </html>
  );
}
