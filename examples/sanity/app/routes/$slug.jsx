import { useState } from "react";
import { useLoaderData } from "remix";

import { getClient } from "~/lib/sanity/getClient";
import { filterDataToSingleItem } from "~/lib/sanity/filterDataToSingleItem";
import Preview from "~/components/Preview";
import { PortableText, urlFor } from "~/lib/sanity/helpers";

export async function loader({ request, params }) {
  const requestUrl = new URL(request?.url);
  const preview =
    requestUrl?.searchParams?.get("preview") ===
    process.env.SANITY_PREVIEW_SECRET;

  // Query for _all_ documents with this slug
  // There could be two: Draft and Published!
  const query = `*[_type == "movie" && slug.current == $slug]`;
  const queryParams = { slug: params.slug };
  const initialData = await getClient(preview).fetch(query, queryParams);

  return {
    initialData,
    preview,
    // If `preview` mode is active, we'll need these for live updates
    query: preview ? query : null,
    queryParams: preview ? queryParams : null,
  };
}

export default function Movie() {
  let { initialData, preview, query, queryParams } = useLoaderData();

  // If `preview` mode is active, its component update this state for us
  const [data, setData] = useState(initialData);

  // Bonus, a helper function checks the returned documents
  // To show Draft if in preview mode, otherwise Published
  const movie = filterDataToSingleItem(data, preview);

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      {preview ? (
        <Preview
          data={data}
          setData={setData}
          query={query}
          queryParams={queryParams}
        />
      ) : null}
      {/* When working with draft content, optional chain _everything_ */}
      {movie?.title ? <h1>{movie.title}</h1> : null}
      {movie?.poster ? (
        <img
          loading="lazy"
          src={urlFor(movie.poster).width(400).height(200)}
          width="400"
          height="200"
          alt={movie?.title ?? ``}
        />
      ) : null}
      {movie?.overview?.length ? (
        <PortableText blocks={movie?.overview} />
      ) : null}
    </div>
  );
}
