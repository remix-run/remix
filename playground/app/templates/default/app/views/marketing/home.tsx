import { css, type Handle } from "remix/ui";

import { Counter } from "./counter.client.tsx";
import { Document } from "./document.tsx";
import type { Guestbook } from "../../models/guestbook.ts";

export function HomePage(handle: Handle<{ guestbook: Guestbook }>) {
  return () => (
    <Document>
      <main
        mix={css({
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        })}
      >
        <h1>Hello, World!</h1>
        <Counter />
        <ul>
          {handle.props.guestbook.map((entry) => (
            <li key={entry.id}>
              {entry.name} - {new Date(entry.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </main>
    </Document>
  );
}
