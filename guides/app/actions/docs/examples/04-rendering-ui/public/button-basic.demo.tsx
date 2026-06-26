import { css, type Handle, type Props } from "remix/ui";
import * as button from "remix/components/button";

export function ButtonBasic() {
  return () => (
    <div mix={buttonRowCss}>
      <button type="submit" mix={[button.baseStyle, button.primaryStyle]}>
        <AddIcon mix={button.iconStyle} />
        <span mix={button.labelStyle}>Publish</span>
      </button>
      <a href="../../overview/" mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>View button docs</span>
        <ChevronRightIcon mix={button.iconStyle} />
      </a>
    </div>
  );
}

function AddIcon(handle: Handle<Props<"svg">>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

function ChevronRightIcon(handle: Handle<Props<"svg">>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="m6 4 4 4-4 4"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

const buttonRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
});
