import { css } from "remix/ui";
import type { Handle, Props } from "remix/ui";
import input from "remix/ui/input";

/**
 * @name Input Basic
 * @description The input mixin styles standalone inputs and icon-capable input roots.
 * @layout center
 */
export function InputBasic() {
  return () => (
    <div mix={inputDemoCss}>
      <label mix={fieldCss}>
        <span mix={labelCss}>Standalone</span>
        <input mix={input()} placeholder="Placeholder" />
      </label>

      <div mix={fieldCss}>
        <span mix={labelCss}>With icon</span>
        <div mix={input.root()}>
          <SearchIcon />
          <input
            aria-label="With icon"
            mix={input.field()}
            placeholder="Placeholder"
          />
        </div>
      </div>

      <div mix={fieldCss}>
        <span mix={labelCss}>Filled</span>
        <div mix={input.root()}>
          <input aria-label="Filled" defaultValue="Value" mix={input.field()} />
        </div>
      </div>

      <label mix={fieldCss}>
        <span mix={labelCss}>Disabled</span>
        <input disabled mix={input()} placeholder="Placeholder" />
      </label>
    </div>
  );
}

function SearchIcon(handle: Handle<Props<"svg">>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="m11.25 11.25 2.5 2.5M12.25 7a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

const inputDemoCss = css({
  display: "grid",
  gap: "20px",
  width: "min(100%, 40rem)",
});

const fieldCss = css({
  display: "grid",
  gap: "8px",
});

const labelCss = css({
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "14px",
  lineHeight: "18px",
  fontWeight: 600,
  color: "#101010",
});
