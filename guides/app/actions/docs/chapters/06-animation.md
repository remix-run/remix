---
title: Animation
description: The CSS-first animation model and Remix UI helpers for motion that respects rendering state.
---

## CSS-first visual states {#css-first-visual-states}

Start with CSS when the browser already owns the state. Hover, focus, active, checked, open, selected, and reduced-motion states do not need JavaScript state unless your render output also depends on them.

```tsx filename=app/ui/pressable-card.tsx
import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

export function PressableCard(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <button mix={cardStyle} type="button">
      {handle.props.children}
    </button>
  );
}

const cardStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "16px",
  background: "white",
  cursor: "pointer",
  font: "inherit",
  padding: "1rem",
  transition: "transform 160ms ease, box-shadow 160ms ease",
  "&:hover, &:focus-visible": {
    boxShadow: "0 12px 32px rgba(15, 17, 21, 0.14)",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});
```

Use Remix animation helpers when the motion depends on rendering state: a node enters, a node exits, a keyed item moves, or an event needs an interruptible animation.

::frame{src="/examples/06-animation/press-state/"}

## Entrance and exit animations {#entrance-and-exit-animations}

`animateEntrance(...)` runs when a host node is inserted. `animateExit(...)` lets a removed node stay in the DOM until its exit animation finishes.

```tsx filename=app/assets/notice.tsx
import { clientEntry, css, on } from "remix/ui";
import { animateEntrance, animateExit, spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

export const Notice = clientEntry(
  import.meta.url,
  function Notice(handle: Handle) {
    let visible = true;

    return () => (
      <div>
        <button
          mix={[
            on("click", () => {
              visible = !visible;
              handle.update();
            }),
          ]}
          type="button"
        >
          Toggle notice
        </button>
        {visible && (
          <p
            key="notice"
            mix={[
              noticeStyle,
              animateEntrance({
                opacity: 0,
                transform: "translateY(8px)",
                ...spring("snappy"),
              }),
              animateExit({
                opacity: 0,
                transform: "translateY(-8px)",
                ...spring("snappy"),
              }),
            ]}
          >
            Settings saved.
          </p>
        )}
      </div>
    );
  },
);

const noticeStyle = css({
  borderRadius: "12px",
  background: "#ecfdf5",
  color: "#065f46",
  padding: "0.75rem 1rem",
});
```

Keep keys stable when toggling between related elements. A stable key tells Remix which node is entering, exiting, or being replaced.

Pass `true` for the default opacity animation or `false` to disable a mixin without changing the surrounding `mix` array. `animateEntrance({ initial: false })` skips the first insertion for a key but still animates later insertions. If the same keyed element returns before its exit finishes, Remix reclaims that DOM node and animates it back toward its rendered styles.

::frame{src="/examples/06-animation/notice-presence/"}

## Layout animations {#layout-animations}

`animateLayout(...)` measures a host node before and after a render, then animates the visual delta. This is the right tool for sorted lists, expanding cards, and elements that move because layout changed.

```tsx filename=app/assets/reorder-list.tsx
import { clientEntry, css, on } from "remix/ui";
import { animateLayout, spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

const initialItems = ["Design", "Build", "Review"];

export const ReorderList = clientEntry(
  import.meta.url,
  function ReorderList(handle: Handle) {
    let items = initialItems;

    return () => (
      <div>
        <button
          mix={[
            on("click", () => {
              items = [...items].reverse();
              handle.update();
            }),
          ]}
          type="button"
        >
          Reverse
        </button>
        <ul mix={listStyle}>
          {items.map((item) => (
            <li
              key={item}
              mix={[itemStyle, animateLayout({ ...spring("bouncy") })]}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

const listStyle = css({
  display: "grid",
  gap: "0.5rem",
  listStyle: "none",
  padding: 0,
});

const itemStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "10px",
  padding: "0.7rem 1rem",
});
```

`key` is not optional for layout animation in lists. Without stable keys, the runtime cannot know whether an item moved or a different item replaced it.

Layout animation includes size projection by default. Pass `size: false` when only position should animate and scaling the element's contents would look wrong.

::frame{src="/examples/06-animation/reordering/"}

## Springs, tweens, and easing {#springs-tweens-and-easing}

`spring()` returns an iterator decorated for CSS transitions and Web Animations. Stringify it in CSS, spread it into animation options, or iterate it for custom JavaScript animation.

```tsx filename=app/assets/bouncy-switch.tsx
import { clientEntry, css, on } from "remix/ui";
import { spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

export const BouncySwitch = clientEntry(
  import.meta.url,
  function BouncySwitch(handle: Handle) {
    let enabled = true;

    return () => (
      <button
        aria-pressed={enabled}
        mix={[
          switchStyle,
          on("click", () => {
            enabled = !enabled;
            handle.update();
          }),
        ]}
        type="button"
      >
        <span
          mix={thumbStyle}
          style={{
            transform: enabled ? "translateX(2.25rem)" : "translateX(0)",
          }}
        />
      </button>
    );
  },
);

const switchStyle = css({
  border: 0,
  borderRadius: "999px",
  background: "#ff6b35",
  cursor: "pointer",
  padding: "0.25rem",
  width: "5rem",
});

const thumbStyle = css({
  display: "block",
  width: "2rem",
  height: "2rem",
  borderRadius: "50%",
  background: "white",
  transition: spring.transition("transform", "bouncy"),
});
```

Use `tween(...)` when you need a time-based value loop rather than CSS or WAAPI timing.

```ts filename=app/assets/count-up.ts
import { easings, tween } from "remix/ui/animation";

export function countUp(
  from: number,
  to: number,
  onValue: (value: number) => void,
) {
  let animation = tween({ from, to, duration: 300, curve: easings.easeOut });
  animation.next();

  function tick(timestamp: number) {
    let result = animation.next(timestamp);
    onValue(result.value);

    if (!result.done) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}
```

Prefer CSS transitions and animation mixins for ordinary UI. Use `tween` for canvas, custom counters, or values that are not CSS properties.

::frame{src="/examples/06-animation/spring-drag-release/"}

::frame{src="/examples/06-animation/bouncy-switch/"}

The UI package also keeps a gallery of smaller motion experiments. Keep this kind of broad demo in a bounded frame so it does not take over the surrounding guide page.

::frame{src="/examples/06-animation/animation-gallery/"}

## Interruptible interactions {#interruptible-interactions}

Event handlers receive abort signals, and animation mixins cancel or replace in-flight work when the DOM changes again. That makes interruption the default path instead of an edge case.

For custom imperative animations, keep the current animation in setup scope and cancel it before starting the next one:

```tsx filename=app/assets/ripple-button.tsx
import { clientEntry, css, on, ref } from "remix/ui";
import { spring } from "remix/ui/animation";
import type { Handle } from "remix/ui";

export const RippleButton = clientEntry(
  import.meta.url,
  function RippleButton(_handle: Handle) {
    let node: HTMLButtonElement;
    let currentAnimation: Animation | undefined;

    return () => (
      <button
        mix={[
          ref((element) => (node = element)),
          buttonStyle,
          on("pointerdown", () => {
            currentAnimation?.cancel();
            currentAnimation = node.animate(
              [{ transform: "scale(0.96)" }, { transform: "scale(1)" }],
              { ...spring("snappy") },
            );
          }),
        ]}
        type="button"
      >
        Press me
      </button>
    );
  },
);

const buttonStyle = css({
  border: 0,
  borderRadius: "999px",
  background: "#9911ff",
  color: "white",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "700",
  padding: "0.8rem 1.1rem",
});
```

CSS transitions are also interruptible: changing the target value while a transition is running makes the browser animate from the current visual state to the new one.

## Reduced-motion behavior {#reduced-motion-behavior}

Respect `prefers-reduced-motion` at the CSS boundary first. It works before JavaScript loads, applies to server-rendered frames, and covers static transitions.

```tsx filename=app/ui/motion-safe-panel.tsx
import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

export function MotionSafePanel(handle: Handle<{ children: RemixNode }>) {
  return () => <section mix={panelStyle}>{handle.props.children}</section>;
}

const panelStyle = css({
  opacity: 1,
  transform: "translateY(0)",
  transition: "opacity 180ms ease, transform 180ms ease",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    transform: "none",
  },
});
```

For JavaScript-driven motion, check the same media query before starting work:

```ts filename=app/assets/motion.ts
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

Reduced motion does not have to mean no feedback. Prefer shorter fades, instant layout changes, or non-motion state changes when movement is not essential.
