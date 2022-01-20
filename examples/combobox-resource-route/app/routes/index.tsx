import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxOption,
  ComboboxPopover
} from "@reach/combobox";
import { Form, useFetcher, useSearchParams } from "remix";

import type { Lang } from "~/models/langs";

// Import the Reach UI styles
import comboboxStyles from "@reach/combobox/styles.css";

export function links() {
  // Add them to the page when this route is active:
  // https://remix.run/docs/en/v1/api/conventions#links
  return [{ rel: "stylesheet", href: comboboxStyles }];
}

export default function Index() {
  // Set up a fetcher to fetch languages as the user types
  const langs = useFetcher<Lang[]>();

  // ComboboxInput is just an <input/> in the end, so we can read the submitted
  // value from teh search params when we submit the form (because it's a "get"
  // form instead of "post", it will be in the URL as a search param).
  const [searchParams] = useSearchParams();

  return (
    <Form>
      <label htmlFor="showSearch">Two-Character Language Code:</label>
      <br />
      <Combobox>
        <div className="combobox-wrapper">
          <ComboboxInput
            id="showSearch"
            name="lang"
            onChange={e => {
              // When the input changes, load the languages
              langs.load(`/lang-search?q=${e.target.value}`);
            }}
          />

          {/* Add a nice spinner when the fetcher is loading */}
          {langs.state === "loading" && <Spinner />}
        </div>

        {/* Only show the popover if we have results */}
        {langs.data && langs.data.length > 0 && (
          <ComboboxPopover>
            <ComboboxList>
              {langs.data.map((lang, index) => (
                <ComboboxOption key={index} value={lang.alpha2}>
                  {lang.name} ({lang.alpha2})
                </ComboboxOption>
              ))}
            </ComboboxList>
          </ComboboxPopover>
        )}
      </Combobox>
      <p>
        <button type="submit">Submit</button>{" "}
        {searchParams.has("lang") && (
          <span>You submitted: {searchParams.get("lang")}</span>
        )}
      </p>
    </Form>
  );
}

function Spinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className="spinner"
    >
      <path
        stroke="#000"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M20 4v5h-.582m0 0a8.001 8.001 0 00-15.356 2m15.356-2H15M4 20v-5h.581m0 0a8.003 8.003 0 0015.357-2M4.581 15H9"
      />
    </svg>
  );
}
