import type { LinksFunction } from "@remix-run/node";

import styles from "~/styles/styles.css";
import { Themed, ThemeToggle } from "~/utils/theme-provider";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export default function IndexRoute() {
  return (
    <>
      <ThemeToggle>Toggle</ThemeToggle>
      <Themed
        dark={<h1 className="dark-component">I'm only seen in dark mode</h1>}
        light={<h1 className="light-component">I'm only seen in light mode</h1>}
      />
    </>
  );
}
