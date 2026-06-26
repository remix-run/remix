import { css } from "remix/ui";
import type { Handle } from "remix/ui";
import { animateLayout, spring } from "remix/ui/animation";

export function ReorderingDemo(handle: Handle) {
  let order = initialOrder;

  function scheduleNextShuffle(signal: AbortSignal) {
    let timeoutId = setTimeout(async () => {
      if (signal.aborted) return;
      order = shuffle(order);
      let nextSignal = await handle.update();
      if (nextSignal.aborted) return;
      scheduleNextShuffle(nextSignal);
    }, 1000);

    signal.addEventListener("abort", () => clearTimeout(timeoutId), {
      once: true,
    });
  }

  handle.queueTask(scheduleNextShuffle);

  return () => (
    <ul mix={listStyles}>
      {order.map((backgroundColor) => (
        <li
          key={backgroundColor}
          mix={[
            itemStyles,
            animateLayout({
              ...spring({ duration: 600, bounce: 0.2 }),
            }),
          ]}
          style={{ backgroundColor }}
        />
      ))}
    </ul>
  );
}

const initialOrder = ["#ff0088", "#dd00ee", "#9911ff", "#0d63f8"];

function shuffle<item>(array: item[]): item[] {
  let result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let current = result[i];
    result[i] = result[j];
    result[j] = current;
  }
  return result;
}

const listStyles = css({
  display: "flex",
  position: "relative",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  width: 220,
  gap: 10,
  margin: 0,
  padding: 0,
  listStyle: "none",
});

const itemStyles = css({
  width: 100,
  height: 100,
  borderRadius: 10,
});
