import { css, type Handle } from "remix/component";
import * as combobox from "@remix-run/ui/combobox";

/**
 * @name Combobox Primitives
 * @description Headless combobox behavior with minimal local styles.
 * @layout center
 */
export function ComboboxPrimitives(handle: Handle) {
  let value = "none";

  return () => (
    <div
      mix={[
        css({
          display: "grid",
          gap: "8px",
          width: "min(100%, 18rem)",
        }),
        combobox.onComboboxChange((event) => {
          value = event.value ?? "none";
          void handle.update();
        }),
      ]}
    >
      <label
        mix={css({
          color: "#101010",
          font: '600 12px/16px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
          letterSpacing: 0,
        })}
        for={`${handle.id}-field`}
      >
        Framework
      </label>

      <combobox.Context name="framework">
        <input
          id={`${handle.id}-field`}
          mix={[
            css({
              boxSizing: "border-box",
              width: "100%",
              height: "32px",
              border: "1px solid #cfcfcf",
              borderRadius: "6px",
              color: "#101010",
              font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
              letterSpacing: 0,
              padding: "0 10px",
              "&:focus-visible": {
                borderColor: "#3573f6",
                outline: "2px solid #1A72FF",
              },
            }),
            combobox.input(),
          ]}
          placeholder="Search frameworks"
        />

        <div
          mix={[
            css({
              boxSizing: "border-box",
              margin: 0,
              border: "1px solid #cfcfcf",
              borderRadius: "6px",
              background: "#ffffff",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              padding: "4px",
              "&:popover-open": {
                display: "block",
              },
            }),
            combobox.popover(),
          ]}
        >
          <div
            mix={[
              css({
                display: "grid",
                gap: "2px",
                maxHeight: "12rem",
                overflow: "auto",
                outline: 0,
              }),
              combobox.list(),
            ]}
          >
            {frameworks.map((option) => (
              <div
                key={option.value}
                mix={[
                  css({
                    borderRadius: "4px",
                    color: "#101010",
                    font: '500 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
                    letterSpacing: 0,
                    padding: "6px 8px",
                    '&[data-highlighted="true"]': {
                      background: "#eeeeee",
                    },
                    '&[aria-selected="true"]': {
                      background: "#101010",
                      color: "#ffffff",
                    },
                    '&[aria-disabled="true"]': {
                      color: "#9a9a9a",
                    },
                  }),
                  combobox.option(option),
                ]}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>

        <input
          mix={[
            css({
              display: "none",
            }),
            combobox.hiddenInput(),
          ]}
        />
      </combobox.Context>

      <p
        mix={css({
          margin: 0,
          color: "#666666",
          font: "500 12px/16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        })}
      >{`value=${value}`}</p>
    </div>
  );
}

const frameworks = [
  { label: "Remix", searchValue: ["remix", "rmx"], value: "remix" },
  {
    label: "React Router",
    searchValue: ["react router", "router"],
    value: "react-router",
  },
  { label: "React", value: "react" },
  { disabled: true, label: "Archived", value: "archived" },
];
