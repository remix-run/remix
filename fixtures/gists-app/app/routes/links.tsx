import type { LinksFunction, LoaderFunction } from "remix";
import { useRouteData, Link } from "remix";

import redTextHref from "../styles/redText.css";
import blueTextHref from "../styles/blueText.css";
// import guitar from "img:../components/guitar.jpg?width=500&height=500";
// import notPreloadedGuitar from "img:../components/guitar.jpg?width=600&height=600";

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

export let links: LinksFunction = ({ data }: { data: any[] }) => {
  // this blocks on transitions automatically
  let styleLink = { rel: "stylesheet", href: redTextHref };
  let nonMatching = {
    rel: "stylesheet",
    href: blueTextHref,
    media: "(prefers-color-scheme: beef)"
  };

  let fails = { rel: "stylesheet", href: "/fails.css" };

  // block on this image
  // let blocker = block({ rel: "preload", as: "image", href: guitar.src });

  // preload gist pages, get data for the first
  let pageLinks = data.map((user, index) => ({
    page: `/gists/${user.id}`,
    data: index === 0
  }));

  return [styleLink, nonMatching, fails, ...pageLinks];
};

export default function LinksPage() {
  let users = useRouteData<User[]>();
  return (
    <div data-test-id="/links">
      <h2>Links Page</h2>
      {users.map(user => (
        <li key={user.id}>
          <Link to={`/gists/${user.id}`}>{user.name}</Link>
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
