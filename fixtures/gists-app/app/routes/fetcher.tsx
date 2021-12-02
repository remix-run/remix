import { Form, useFetcher } from "remix";

export const action = () => {
  throw new Error("Whoops!");
};

export default function Component() {
  const fetcher = useFetcher();

  return (
    <div>
      <fetcher.Form method="post">
        <button type="submit">Submit fetcher form</button>
      </fetcher.Form>
      <Form method="post">
        <button type="submit">Submit regular form</button>
      </Form>
    </div>
  );
}
