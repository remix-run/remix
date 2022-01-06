import type { Note, Site } from "collected-notes";
import type { LoaderFunction } from "remix";
import { Form, json, Link, useLoaderData, useSearchParams } from "remix";
import { cn, sitePath } from "~/cn.server";

type LoaderData = {
  site: Site;
  notes: Note[];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const term = url.searchParams.get("term") || "";
  const page = Number(url.searchParams.get("page") || "1");

  const hasSearch = term.trim().length > 0;

  const [notes = [], { site }] = await Promise.all([
    hasSearch
      ? cn.search(sitePath, term, page, "public_site")
      : cn.latestNotes(sitePath, page, "public_site"),
    cn.site(sitePath)
  ]);

  return json<LoaderData>({ notes, site });
};

export default function Screen() {
  const { site, notes } = useLoaderData<LoaderData>();
  const [params] = useSearchParams();
  const term = params.get("term") || "";
  const page = Number(params.get("page") || "1");
  console.log(notes);
  return (
    <main>
      <header>
        <h1>{site.name}</h1>
        <p>{site.headline}</p>
      </header>

      <Form role="search" reloadDocument>
        <label htmlFor="term">Term</label>
        <input type="search" name="term" id="term" defaultValue={term} />
        <button>Search</button>
      </Form>

      <ul>
        {notes.map(note => {
          return (
            <li key={note.id}>
              <a href={note.path}>{note.title}</a>
              <p>{note.headline}</p>
              <time dateTime={note.created_at}>
                {new Date(note.created_at).toLocaleDateString("en", {
                  year: "numeric",
                  month: "long",
                  day: "2-digit"
                })}
              </time>
            </li>
          );
        })}
      </ul>

      {page > 1 ? (
        <Link to={`?page=${page - 1}&term=${term}`}>Previous Page</Link>
      ) : null}

      {notes.length === 40 ? (
        <Link to={`?page=${page + 1}&term=${term}`}>Next Page</Link>
      ) : null}
    </main>
  );
}
