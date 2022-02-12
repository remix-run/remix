import * as React from "react";
import cx from "clsx";

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    { children, className, align = "start", gap = 0, ...props },
    forwardedRef
  ) => {
    const alignments: Partial<Record<AlignClass, boolean>> =
      typeof align === "object"
        ? Object.entries(align).reduce((acc, cur) => {
            const vp = cur[0] as Viewport;
            const al = cur[1];
            const key: AlignClass = `ui--stack--align-${vp}-${al}`;
            return { ...acc, [key]: true };
          }, {})
        : { [`ui--stack--align-default-${align}`]: true };

    const gaps: Partial<Record<GapClass, boolean>> =
      typeof gap === "object"
        ? Object.entries(gap).reduce((acc, cur) => {
            const vp = cur[0] as Viewport;
            const gap = cur[1];
            const key: GapClass = `ui--stack--gap-${vp}-${gap}`;
            return { ...acc, [key]: true };
          }, {})
        : { [`ui--stack--gap-default-${gap}`]: true };

    return (
      <div
        ref={forwardedRef}
        className={cx("ui--stack", alignments, gaps)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = "Stack";

interface StackProps extends React.ComponentPropsWithRef<"div"> {
  align?: Alignment | Record<"default" | Viewport, Alignment>;
  gap?: Gap | Record<"default" | Viewport, Gap>;
}

type Alignment = "start" | "center" | "end";
type Viewport = "sm" | "md" | "lg" | "xl" | "2x" | "3x";
type Gap = 0 | 1 | 2 | 3 | 4 | 5;
type BaseClass = `ui--stack`;
type AlignClass = `${BaseClass}--align-${"default" | Viewport}-${Alignment}`;
type GapClass = `${BaseClass}--gap-${"default" | Viewport}-${Gap}`;

export type { StackProps };
export { Stack };
