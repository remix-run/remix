import type { LinksFunction, LoaderFunction } from "remix";
import { useLoaderData, Link } from "remix";

import redTextHref from "~/styles/redText.css";
import blueTextHref from "~/styles/blueText.css";

interface User {
  name: string;
  id: string;
}

export let loader: LoaderFunction = (): User[] => {
  return [
    { name: "Michael Jackson", id: "mjackson" },
    { name: "Ryan Florence", id: "ryanflorence" }
  ];
};

export let links: LinksFunction = () => {
  // this blocks on transitions automatically
  let styleLink = { rel: "stylesheet", href: redTextHref };
  let nonMatching = {
    rel: "stylesheet",
    href: blueTextHref,
    media: "(prefers-color-scheme: beef)"
  };

  let fails = { rel: "stylesheet", href: "/fails.css" };

  // preload another page
  let pageLink = { page: `/gists/mjackson` };

  return [styleLink, nonMatching, fails, pageLink];
};

export default function LinksPage() {
  let users = useLoaderData<User[]>();
  return (
    <div data-test-id="/links">
      <h2>Links Page</h2>
      {users.map(user => (
        <li key={user.id}>
          <Link to={`/gists/${user.id}`} prefetch="none">
            {user.name}
          </Link>
        </li>
      ))}
      {/*
      <hr />
      <p>
        <img alt="another guitar..." src={guitar.src} data-test-id="blocked" />
        <br />
        Preloaded and blocked guitar, no layout shift.
      </p>
      <p>
        <img
          alt="another guitar..."
          src={notPreloadedGuitar.src}
          data-test-id="not-blocked"
        />
        <br />
        Not preloaded, not blocked, layout shift!
      </p>
      */}
    </div>
  );
}
