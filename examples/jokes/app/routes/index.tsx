import { Link } from "remix";
import type { MetaFunction, LinksFunction } from "remix";
import stylesUrl from "../styles/index.css";

export let meta: MetaFunction = () => {
  return {
    title: "Remix: It's funny!",
    description: "Remix jokes app. Learn Remix and laugh at the same time!",
  };
};

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export default function Index() {
  return (
    <div className="container">
      <div className="content">
        <h1>
          Remix <span>Jokes!</span>
        </h1>
        <nav>
          <ul>
            <li>
              <Link to="jokes">Read Jokes</Link>
            </li>
            <li>
              <Link to="about">About Us</Link>
            </li>
            <li>
              <Link reloadDocument to="/jokes-rss">
                RSS
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
