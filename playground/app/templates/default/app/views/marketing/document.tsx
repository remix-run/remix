import type { Handle, RemixNode } from "remix/ui";
import { css } from "remix/ui";

import { routes } from "../../routes.ts";

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
}

const DEFAULT_TITLE = "My Remix App";

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE } = handle.props;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
        </head>
        <body mix={css({ margin: 0 })}>
          <NavBar />
          {children}
          <script type="module" src={routes.assets.href({ path: "app/entry.client.ts" })}></script>
        </body>
      </html>
    );
  };
}

function NavBar() {
  return () => (
    <nav
      mix={css({
        display: "flex",
        gap: "1rem",
        padding: "1rem",
        background: "var(--surface-2)",
      })}
    >
      <a href={routes.marketing.home.href()}>Home</a>
      <a href={routes.marketing.about.href()}>About</a>
    </nav>
  );
}
