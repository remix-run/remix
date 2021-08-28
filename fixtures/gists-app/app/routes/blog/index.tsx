import type { HeadersFunction, LinksFunction, LoaderFunction } from "remix";
import { Link, useRouteData, usePendingLocation, json } from "remix";

// @ts-expect-error
import Shared from "../../components/Shared";
import stylesHref from "../../styles/gists.css";

import * as helloPost from "./hello-world.mdx";
import * as secondPost from "./second.md";
import * as thirdPost from "./third.md";

interface Post {
  title: string;
  description: string;
  slug: string;
}

type PostsData = { posts: Post[] };

function postFromModule(mod: any): Post {
  return {
    slug: mod.filename.replace(/\.mdx?$/, ""),
    ...mod.attributes.meta
  };
}

export let loader: LoaderFunction = () => {
  let data: PostsData = {
    posts: [
      postFromModule(helloPost),
      postFromModule(secondPost),
      postFromModule(thirdPost)
    ]
  };

  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
};

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesHref }];
};

export let headers: HeadersFunction = ({ loaderHeaders }) => {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")!
  };
};

export default function BlogPosts() {
  let locationPending = usePendingLocation();
  let { posts } = useRouteData<PostsData>();

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
