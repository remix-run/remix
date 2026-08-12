import { css, on } from "remix/ui";
import type { Handle } from "remix/ui";

export function SearchFilterDemo(handle: Handle) {
  let query = "";

  return () => {
    let results = projects.filter((project) => project.toLowerCase().includes(query.toLowerCase()));

    return (
      <div mix={searchStyles}>
        <label mix={labelStyles}>
          Search projects
          <input
            mix={[
              inputStyles,
              on("input", (event) => {
                query = event.currentTarget.value;
                handle.update();
              }),
            ]}
            type="search"
            placeholder="Try docs, billing, or design"
            value={query}
          />
        </label>

        <ul mix={resultListStyles}>
          {results.map((project) => (
            <li key={project} mix={resultItemStyles}>
              {project}
            </li>
          ))}
        </ul>
      </div>
    );
  };
}

const projects = [
  "Docs redesign",
  "Billing portal",
  "Design system",
  "Frame navigation",
  "Search indexing",
];

const searchStyles = css({
  display: "grid",
  gap: "0.75rem",
  width: "min(100%, 22rem)",
});

const labelStyles = css({
  display: "grid",
  gap: "0.35rem",
  color: "#151515",
  fontSize: "0.85rem",
  fontWeight: "700",
});

const inputStyles = css({
  boxSizing: "border-box",
  width: "100%",
  border: "1px solid #d6d6d6",
  borderRadius: "999px",
  font: "inherit",
  fontWeight: "400",
  padding: "0.7rem 1rem",
  "&:focus": {
    outline: "2px solid #d83a5a",
    outlineOffset: "2px",
  },
});

const resultListStyles = css({
  display: "grid",
  gap: "0.4rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
});

const resultItemStyles = css({
  border: "1px solid #e7e7e7",
  borderRadius: "10px",
  background: "white",
  padding: "0.65rem 0.75rem",
});
