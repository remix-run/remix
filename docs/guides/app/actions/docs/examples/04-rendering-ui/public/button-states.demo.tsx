import { css } from "remix/ui";
import button from "remix/ui/button";

/**
 * @name Button States
 * @description Native button state, aria-pressed, disabled, and busy styles compose with local app styling.
 * @layout center
 */
export function ButtonStates() {
  return () => (
    <div mix={buttonRowCss}>
      <button mix={button({ tone: "primary" })}>Default</button>
      <button aria-pressed="true" mix={button({ tone: "primary" })}>
        Pressed
      </button>
      <button disabled mix={button()}>
        Disabled
      </button>
      <button aria-busy="true" mix={[button(), busyButtonCss]}>
        <SpinnerIcon />
        Saving
      </button>
    </div>
  );
}

function SpinnerIcon() {
  return () => (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="16" height="16">
      <path
        d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

const buttonRowCss = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
});

const busyButtonCss = css({
  "@keyframes demo-button-spin": {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },
  "& svg": {
    width: "14px",
    height: "14px",
    opacity: 0.72,
    animation: "demo-button-spin 1s linear infinite",
  },
});
