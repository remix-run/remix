import * as React from "react";
import cx from "clsx";

const ShadowBox = React.forwardRef<HTMLDivElement, ShadowBoxProps>(
  (props, ref) => {
    const { pad, ...domProps } = props;
    return (
      <div
        ref={ref}
        {...domProps}
        className={cx(props.className, "ui--shadow-box", {
          [`ui--shadow-box--pad-0${pad}`]: pad != null
        })}
      />
    );
  }
);
ShadowBox.displayName = "ShadowBox";

interface ShadowBoxProps extends React.ComponentPropsWithRef<"div"> {
  pad?: 1 | 2 | 3;
}

export type { ShadowBoxProps };
export { ShadowBox };
