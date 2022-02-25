import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxOption,
  ComboboxPopover,
} from "@reach/combobox";
import { useFetcher } from "remix";

import type { Lang } from "~/models/langs";

export default function LangCombobox() {
  // Set up a fetcher to fetch languages as the user types
  const langs = useFetcher<Lang[]>();

  return (
    <Combobox>
      <div className="combobox-wrapper">
        <label htmlFor="showSearch">Lang Search</label>
        <ComboboxInput
          id="showSearch"
          name="lang"
          onChange={(e) => {
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
