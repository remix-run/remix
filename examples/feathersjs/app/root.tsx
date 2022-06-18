import { useEffect, useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from "@remix-run/react";
import { SocketProvider } from "./context";
import io from 'socket.io-client';
import type { Socket } from "socket.io-client";

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});
export default function App() {
  const [ feathers, setFeathers ] = useState<typeof Socket>();


  useEffect(() => {
    const socket = io();
    setFeathers(socket);
  }, [])

  useEffect(() => {
    if(!feathers) return;
    feathers.on('confirmation', (data: any) => {
      console.log(data);
    })
  }, [feathers])
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <SocketProvider socket={feathers}>
          <Outlet />
        </SocketProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
