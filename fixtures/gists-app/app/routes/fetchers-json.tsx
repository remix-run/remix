import type { ActionFunction } from "remix";
import { json, useFetcher } from "remix";

export let action: ActionFunction = async ({ request }) => {
  let data = await request.json();
  return json(data);
};

export default function () {
  let fetcher = useFetcher();
  let handleClick = () => {
    fetcher.submit(
      {
        title: "Remix",
        isActive: true,
        count: 123,
        list: ["a", "b", "c"],
        nested: { message: "hello world" }
      },
      {
        method: "post",
        action: "/fetchers-json",
        json: true
      }
    );
  };
  return (
    <div>
      <h2>useFetcher with JSON</h2>
      <button onClick={handleClick}>POST JSON</button>
      <pre>{JSON.stringify(fetcher.data, null, 2)}</pre>
    </div>
  );
}
