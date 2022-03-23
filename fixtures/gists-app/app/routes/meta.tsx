import type { LoaderFunction, MetaFunction } from "remix";
import { json, useLoaderData } from "remix";

export let loader: LoaderFunction = async () => {
  return json({
    title: "Meta Page",
    description: "This is a meta page",
  });
};

export let meta: MetaFunction = ({ data }) => {
  return {
    title: data.title,
    description: data.description,
    "og:image": "https://picsum.photos/200/200",
    "og:type": data.contentType, // undefined
  };
};

export default function MetaPage() {
  let { title } = useLoaderData();
  return (
    <div data-test-id="/links">
      <h2>{title}</h2>
      <hr />
    </div>
  );
}
