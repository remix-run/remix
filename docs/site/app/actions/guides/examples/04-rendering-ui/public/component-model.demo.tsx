import { css, on } from "remix/component";
import type { Handle } from "remix/component";

export function ComponentModelDemo() {
  return () => (
    <div mix={css({ display: "flex", gap: "0.75rem" })}>
      <VoteButton album="Thriller" initialVotes={12} />
      <VoteButton album="Bad" initialVotes={9} />
    </div>
  );
}

function VoteButton(handle: Handle<{ album: string; initialVotes: number }>) {
  let votes = handle.props.initialVotes;

  return () => (
    <button
      type="button"
      mix={[
        on("click", () => {
          votes++;
          handle.update();
        }),
        css({
          display: "grid",
          gap: "0.25rem",
          minWidth: "9rem",
          padding: "1rem",
          border: 0,
          borderRadius: "12px",
          background: "light-dark(white, #2a2a30)",
          color: "light-dark(#151515, #f4f4f5)",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          transition: "box-shadow 150ms ease, transform 150ms ease",
          "&:hover, &:focus-visible": {
            boxShadow: "0 8px 24px light-dark(rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.5))",
            transform: "translateY(-2px)",
          },
        }),
      ]}
    >
      <strong mix={css({ color: "light-dark(#d83a5a, #ff6b88)", fontSize: "2rem" })}>
        {votes}
      </strong>
      <span>{handle.props.album}</span>
    </button>
  );
}
