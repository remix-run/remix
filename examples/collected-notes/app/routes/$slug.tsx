import type { HTML } from "collected-notes";
import type { LoaderFunction } from "remix";
import { json, useLoaderData } from "remix";
import { cn, sitePath } from "~/cn.server";

type LoaderData = {
  body: HTML;
};

export const loader: LoaderFunction = async ({ params }) => {
  const slug = params.slug;
  if (typeof slug !== "string") throw new Error("Missing slug");
  const { body } = await cn.body(sitePath, slug);
  return json<LoaderData>({ body });
};

export default function Screen() {
  const { body } = useLoaderData<LoaderData>();
  return (
    <main>
      <article dangerouslySetInnerHTML={{ __html: body }} />
    </main>
  );
}
