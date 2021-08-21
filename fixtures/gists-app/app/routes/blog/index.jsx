import { Link, useRouteData, usePendingLocation, json } from "remix";

import Shared from "../../components/Shared";
import stylesHref from "../../styles/gists.css";

import * as helloPost from "./hello-world.mdx";
import * as secondPost from "./second.md";
import * as thirdPost from "./third.md";

let postFromModule = (mod) => {
  return {
    slug: mod.filename.replace(/\.mdx?$/, ""),
    ...mod.attributes.meta
  };
}

export function loader() {
  let data = {
    posts: [
      postFromModule(helloPost),
      postFromModule(secondPost),
      postFromModule(thirdPost),
    ]
  };

  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
}

export function links() {
  return [{ rel: "stylesheet", href: stylesHref }];
}

export function headers({ loaderHeaders }) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}

export default function BlogPosts() {
  let locationPending = usePendingLocation();
  let { posts } = useRouteData();

  return (
    <div data-test-id="/blog">
      <header>
        <h1>Blog Posts</h1>
        <ul>
          {posts.map(post => (
            <li key={post.slug}>
              <Link to={post.slug} className="text-blue-700 underline">
                {post.title} {locationPending && "..."}
              </Link>
            </li>
          ))}
        </ul>
      </header>
      <Shared />
    </div>
  );
}
