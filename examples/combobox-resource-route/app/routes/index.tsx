import { Form, useSearchParams } from "remix";

// Import the Reach UI styles
import comboboxStyles from "@reach/combobox/styles.css";
import LangCombobox from "~/components/lang-combobox";

export function links() {
  // Add them to the page when this route is active:
  // https://remix.run/api/conventions#links
  return [{ rel: "stylesheet", href: comboboxStyles }];
}

export default function Index() {
  // ComboboxInput is just an <input/> in the end, so we can read the submitted
  // value from teh search params when we submit the form (because it's a "get"
  // form instead of "post", it will be in the URL as a search param).
  const [searchParams] = useSearchParams();

  return (
    <Form>
      <label htmlFor="showSearch">Two-Character Language Code:</label>
      <br />
      <LangCombobox />
      <p>
        <button type="submit">Submit</button>{" "}
        {searchParams.has("lang") && (
          <span>You submitted: {searchParams.get("lang")}</span>
        )}
      </p>
    </Form>
  );
}
