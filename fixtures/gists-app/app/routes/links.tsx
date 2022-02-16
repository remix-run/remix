import type { LinksFunction, LoaderFunction } from "remix";
import { useLoaderData, Link } from "remix";

import redTextHref from "~/styles/redText.css";
import blueTextHref from "~/styles/blueText.css";
import guitar from "~/components/guitar.jpg";

interface User {
  name: string;
  id: string;
}

export let loader: LoaderFunction = async (): User[] => {
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

  let preloadGuitar = { rel: "preload", as: "image", href: guitar };

  return [styleLink, nonMatching, fails, pageLink, preloadGuitar];
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

      <hr />
      <p>
        <img alt="a guitar" src={guitar} data-test-id="blocked" /> Prefetched
        because it's a preload.
      </p>
    </div>
  );
}
