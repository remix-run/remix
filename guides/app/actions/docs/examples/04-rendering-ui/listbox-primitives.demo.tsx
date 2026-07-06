import { css, type Handle } from "remix/ui";
import * as listbox from "remix/ui/listbox";
import type { ListboxValue } from "remix/ui/listbox";

/**
 * @name Listbox
 * @description Controlled selection and highlight state with the listbox primitives.
 * @layout center
 */
export function ListboxPrimitives(handle: Handle) {
  let value: ListboxValue = "remix";
  let activeValue: ListboxValue = "remix";

  return () => (
    <div mix={demoCss}>
      <p mix={labelCss}>Framework</p>

      <listbox.Context
        value={value}
        activeValue={activeValue}
        onSelect={(nextValue) => {
          value = nextValue;
          activeValue = nextValue;
          void handle.update();
        }}
        onHighlight={(nextValue) => {
          activeValue = nextValue;
          void handle.update();
        }}
      >
        <div
          aria-label="Framework"
          mix={[listCss, listbox.list()]}
          tabIndex={0}
        >
          {frameworks.map((option) => (
            <div key={option.value} mix={[optionCss, listbox.option(option)]}>
              {option.label}
            </div>
          ))}
        </div>
      </listbox.Context>

      <p mix={valueCss}>{`value=${value ?? "null"}`}</p>
    </div>
  );
}

const frameworks = [
  { label: "Remix", value: "remix" },
  { label: "React Router", value: "react-router" },
  { label: "React", value: "react" },
  { disabled: true, label: "Archived", value: "archived" },
] as const;

const demoCss = css({
  display: "grid",
  gap: "8px",
  width: "min(100%, 18rem)",
});

const labelCss = css({
  margin: 0,
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: 650,
  letterSpacing: 0,
  color: "rgba(16, 16, 16, 0.72)",
});

const listCss = css({
  display: "grid",
  gap: "2px",
  margin: 0,
  border: "1px solid rgba(0, 0, 0, 0.12)",
  borderRadius: "8px",
  background: "#FFFFFF",
  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)",
  padding: "4px",
  outline: 0,
  "&:focus-visible": {
    boxShadow:
      "0 10px 28px rgba(0, 0, 0, 0.08), 0 0 0 1px #3573F6, 0 0 0 4px rgba(53, 115, 246, 0.1)",
  },
});

const optionCss = css({
  borderRadius: "6px",
  color: "#101010",
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 500,
  letterSpacing: 0,
  padding: "6px 8px",
  '&[data-highlighted="true"]': {
    background: "rgba(16, 16, 16, 0.05)",
  },
  '&[aria-selected="true"]': {
    background: "#101010",
    color: "#FFFFFF",
  },
  '&[aria-disabled="true"]': {
    color: "rgba(16, 16, 16, 0.36)",
  },
});

const valueCss = css({
  margin: 0,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: "12px",
  lineHeight: "16px",
  color: "#4f4f4f",
});
