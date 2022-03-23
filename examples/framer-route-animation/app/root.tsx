import { AnimatePresence, motion } from "framer-motion";
import { Links, LiveReload, Meta, NavLink, Scripts, ScrollRestoration } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { useLocation, useOutlet } from "react-router-dom";

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  const outlet = useOutlet();

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <header>
          <nav>
            <NavLink to="/">Home</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/blogs">Blogs</NavLink>
          </nav>
        </header>
        <AnimatePresence exitBeforeEnter initial={false}>
          <motion.main
            key={useLocation().key}
            initial={{ x: "10%", opacity: 0 }}
            animate={{ x: "0", opacity: 1 }}
            exit={{ x: "-40%", opacity: 0 }}
          >
            {outlet}
          </motion.main>
        </AnimatePresence>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
