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
    <div>
      <h2>Welcome to the Remix Jokes App!</h2>
      <p>This is the home page. There's nothing but potential here!</p>
    </div>
  );
}
