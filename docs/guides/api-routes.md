---
title: API Routes
---

# API Routes

You might be used to building React apps that don't run on the server, or least not very much of it does, so it's backed by a set of API routes. In Remix, most of your routes are both your UI and your API, so Remix in the browser knows how to talk to itself on the server.

In general, you don't need the concept of "API Routes" at all. But we knew you'd come poking around with this term, so here we are!

## Routes are Their Own API

Consider this route:

```tsx filename=routes/teams.js
export function loader() {
  return getTeams();
}

export default function Teams() {
  return <TeamsView teams={useLoaderData()}>
}
```

Whenever the user clicks a link to `<Link to="/teams" />`, Remix in the browser will perform the fetch to the server to get the data from the `loader` and render the route. The entire task of loading data into components has been taken care of. You don't need API routes for data requirements of your route components, they are already their own API.

## Call Loaders Outside of Navigation

There are times, however, that you want to get the data from a loader but not because the user is visiting the route, but the current page needs that route's data for some reason. A very clear example is a `<Combobox>` component that queries the database for records and suggests them to the user.

You can `useFetcher` for cases like this. And once again, since Remix in the browser knows about Remix on the server, you don't have to do much to get the data. Remix's error handling kicks in, race conditions, interruptions, and fetch cancelations are handled for you, too.

For example, you could have a route to handle the search:

```tsx filename=routes/city-search.tsx
export function loader({ request }) {
  let url = new URL(request.url);
  return searchCities(url.searchParams.get("q"));
}
```

And then `useFetcher` along with Reach UI's combobox input:

```tsx [2]
function CitySearchCombobox() {
  let cities = useFetcher();

  return (
    <cities.Form method="get" action="/city-search">
      <Combobox aria-label="Cities">
        <div>
          <ComboboxInput
            name="q"
            onChange={event =>
              cities.submit(event.target.form)
            }
          />
          {cities.state === "submitting" && <Spinner />}
        </div>

        {cities.data && (
          <ComboboxPopover className="shadow-popup">
            {cities.data.error ? (
              <p>Failed to load cities :(</p>
            ) : cities.data.length ? (
              <ComboboxList>
                {cities.data.map(city => (
                  <ComboboxOption
                    key={city.id}
                    value={city.name}
                  />
                ))}
              </ComboboxList>
            ) : (
              <span>No results found</span>
            )}
          </ComboboxPopover>
        )}
      </Combobox>
    </cities.Form>
  );
}
```

## Resource Routes

In other cases, you may need routes that are part of your application, but aren't part of your application's UI. Maybe you want a loader that renders a report as a PDF:

```tsx
export function loader({ params }) {
  let report = await getReport(params.id);
  let pdf = await generateReportPDF(report);
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf"
    }
  });
}
```

If a route is not called by Remix UI (like `<Link>` or `useFetcher`), and does not export a default component, it is now a general purpose Resource Route. If called with `GET`, the loader's response is returned. If called with `POST`, the action's response is called.

Here are a handful of use cases to get you thinking.

- JSON API for a mobile app that reuses server side code with the Remix UI
- Dynamically generating PDFs
- Dynamically generating social images for blog posts or other pages
- Webhooks for other services

You can read more in the [Resource Routes][resource-routes] docs.

[resource-routes]: resource-routes
