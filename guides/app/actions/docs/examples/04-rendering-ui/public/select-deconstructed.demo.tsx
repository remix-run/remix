import { css, type Handle, type Props } from "remix/ui";
import * as button from "remix/components/button";
import * as listbox from "remix/ui/listbox";
import * as popover from "remix/ui/popover";
import * as select from "remix/ui/select";
import { triggerStyle } from "remix/components/select";
import {
  listboxIndicatorStyle,
  listboxLabelStyle,
  listboxListStyle,
  listboxOptionStyle,
  popoverSurfaceStyle,
} from "./shared/listbox-popover-styles.ts";

export function SelectDeconstructed(handle: Handle) {
  let label = "Local";
  let value = "local";
  let triggerId = `${handle.id}-trigger`;

  return () => (
    <div
      mix={[
        stackCss,
        select.onSelectChange((event) => {
          label = event.label ?? "Select an environment";
          value = event.value ?? "null";
          void handle.update();
        }),
      ]}
    >
      <p mix={labelCss}>Environment</p>

      <select.Context
        defaultLabel="Local"
        defaultValue="local"
        name="environment"
      >
        <button
          id={triggerId}
          type="button"
          mix={[button.baseStyle, triggerStyle, select.trigger(), selectCss]}
        >
          <span mix={button.labelStyle}>{label}</span>
          <ChevronVerticalIcon mix={button.iconStyle} />
        </button>

        <popover.Context>
          <div mix={[popoverSurfaceStyle, select.popover()]}>
            <div
              aria-labelledby={triggerId}
              mix={[listboxListStyle, select.list()]}
            >
              {environmentOptions.map((option) => (
                <div
                  key={option.value}
                  mix={[listboxOptionStyle, select.option(option)]}
                >
                  <CheckIcon mix={listboxIndicatorStyle} />
                  <span mix={listboxLabelStyle}>{option.label}</span>
                </div>
              ))}
            </div>
          </div>
        </popover.Context>

        <input mix={select.hiddenInput()} />
      </select.Context>

      <p mix={valueCss}>{`value=${value}`}</p>
    </div>
  );
}

function ChevronVerticalIcon(handle: Handle<Props<"svg">>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="m5 6 3-3 3 3M5 10l3 3 3-3"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

function CheckIcon(handle: Handle<Props<"svg">>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="m3.5 8.5 2.75 2.75 6.25-6.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

const environmentOptions = [
  { label: "Local", value: "local" },
  { label: "Staging", value: "staging" },
  { label: "Production", value: "production" },
  { disabled: true, label: "Archived", value: "archived" },
] as const;

const selectCss = css({
  width: "16rem",
});

const stackCss = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
});

const labelCss = css({
  margin: 0,
  fontSize: "12px",
  fontWeight: "600",
  color: "#151515",
});

const valueCss = css({
  margin: 0,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: "12px",
  color: "#4f4f4f",
});
