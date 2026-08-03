import { css, on } from "remix/ui";
import type { Handle } from "remix/ui";

export function ComponentModelDemo() {
  return () => (
    <div mix={counterDemoStyles}>
      <Counter initialCount={2} label="Inbox" />
      <Counter initialCount={8} label="Deploys" />
    </div>
  );
}

function Counter(handle: Handle<{ initialCount: number; label: string }>) {
  let count = handle.props.initialCount;

  return () => (
    <button
      mix={[
        counterStyles,
        on("click", () => {
          count++;
          handle.update();
        }),
      ]}
      type="button"
    >
      <span mix={counterValueStyles}>{count}</span>
      <span>{handle.props.label}</span>
    </button>
  );
}

const counterDemoStyles = css({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.75rem",
});

const counterStyles = css({
  display: "grid",
  minWidth: "9rem",
  gap: "0.35rem",
  padding: "1rem",
  border: "1px solid #d6d6d6",
  borderRadius: "16px",
  background: "white",
  color: "#151515",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
  boxShadow: "0 8px 24px rgba(15, 17, 21, 0.08)",
  "&:hover": {
    boxShadow: "0 12px 32px rgba(15, 17, 21, 0.12)",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
});

const counterValueStyles = css({
  color: "#d83a5a",
  fontSize: "2.75rem",
  fontWeight: "900",
  lineHeight: "0.9",
  letterSpacing: "-0.08em",
});
