import type {
  HeadersFunction,
  LinksFunction,
  LoaderFunction,
  MdxGlobImport,
  MdxModule
} from "remix";
import { Link, useRouteData, usePendingLocation, json } from "remix";

import stylesHref from "../../styles/gists.css";

interface Post {
  title: string;
  description: string;
  slug: string;
}

type PostsData = { posts: Post[] };

function postFromModule(mod: MdxModule): Post {
  return {
    slug: mod.filename.replace(/\.mdx?$/, ""),
    ...mod.attributes.meta
  };
}

export let loader: LoaderFunction = async () => {
  let postsMod: MdxGlobImport = require("./*.mdx");

  let data: PostsData = {
    posts: postsMod.default.map(post => postFromModule(post))
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
      <main>
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
      </main>
    </div>
  );
}
