import type { LinksFunction } from "remix";

import styles from "~/styles/styles.css";
import { Theme, Themed, useTheme } from "~/utils/theme-provider";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export default function IndexRoute() {
  const [, setTheme] = useTheme();

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
    );
  };

  return (
    <>
      <button onClick={toggleTheme}>Toggle</button>
      <Themed
        dark={<h1 className="dark-component">I'm only seen in dark mode</h1>}
        light={<h1 className="light-component">I'm only seen in light mode</h1>}
      />
    </>
  );
}
