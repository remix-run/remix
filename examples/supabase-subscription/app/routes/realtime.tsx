import { useSubscription } from "react-supabase";
import type { ActionFunction, LoaderFunction } from "remix";
import { Form, json, useFetcher, useLoaderData } from "remix";
import { client } from "~/utils/supabaseClient.server";

export const loader: LoaderFunction = async () => {
  const { count } = await client
    .from("clicks")
    .select("id", { count: "exact", head: true });
  return json<number>(count);
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  if (formData.get("like")) {
    await client.from("clicks").insert([{}]);
  }
  return json({});
};

const Buttons = () => {
  const count = useLoaderData();
  const fetcher = useFetcher();
  useSubscription(
    () => {
      fetcher.submit(null, { method: "post" });
    },
    { event: "INSERT", table: "clicks" }
  );
  return (
    <>
      <Form method="post">
        <button name="like" value="1" type="submit">
          👍 {count}
        </button>
      </Form>
    </>
  );
};
export default Buttons;
